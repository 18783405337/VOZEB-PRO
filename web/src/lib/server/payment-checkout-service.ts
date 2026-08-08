import { BillingInputError } from "@/lib/server/billing-errors";
import { type CommercialOrderSnapshot } from "@/lib/server/billing-commerce-service";
import { expirePendingBillingOrders } from "@/lib/server/billing-order-expiration-service";
import { isAutomaticallyExpiredOrder } from "@/lib/server/billing-service-helpers";
import { createPostgresRepositories, isPostgresDatabaseEnabled, withPostgresTransaction } from "@/lib/server/database";
import { bootstrapLegacyPaymentMerchantAccounts, buildPaymentRuntimeConfigFromMerchant, getPaymentRuntimeConfig, isPaymentRuntimeProviderCheckoutReady, paymentMerchantEnvironment } from "@/lib/server/payment-config-store";
import { MerchantAccountService } from "@/lib/server/payment/merchant-account-service";
import { checkoutFromMetadata, checkoutMetadata, createProviderCheckout, mergeMetadata, normalizeId, normalizeProvider } from "./payment-checkout-providers";
import type { CreatePaymentCheckoutOptions } from "./payment-checkout-types";

export async function createPaymentCheckoutForOrder(orderId: string, options: CreatePaymentCheckoutOptions = {}) {
    if (!isPostgresDatabaseEnabled()) throw new BillingInputError("支付下单需要启用 PostgreSQL", 501);
    await expirePendingBillingOrders({ orderId });

    const paymentConfig = await getPaymentRuntimeConfig();
    await bootstrapLegacyPaymentMerchantAccounts({ runtimeConfig: paymentConfig });
    return withPostgresTransaction(async (client) => {
        const repos = createPostgresRepositories(client);
        const order = await repos.billing.getOrderById(normalizeId(orderId), true);
        assertPayableOrder(order, options.userId, options.tenantId);
        assertOrderTenant(order, options.tenantId);

        const provider = resolveCheckoutProvider(order.provider, options.provider);
        const merchantResolution = await resolveCheckoutMerchant(repos, order, provider, options);
        Object.assign(paymentConfig, buildPaymentRuntimeConfigFromMerchant(merchantResolution.merchant));
        if (!isPaymentRuntimeProviderCheckoutReady(paymentConfig, provider)) throw new BillingInputError("该支付渠道未启用或配置不完整", 400);
        const existing = checkoutFromMetadata(order, provider);
        if (existing) return existing;

        const checkout = await createProviderCheckout(provider, order, options, merchantResolution.merchant);
        const metadata = mergeMetadata(order.metadata, { checkout: checkoutMetadata(checkout) });
        await repos.billing.updateOrder(order.id, {
            provider,
            providerOrderId: checkout.providerOrderId,
            providerPaymentId: checkout.providerPaymentId,
            metadata,
            collectionMode: merchantResolution.snapshot.collectionMode,
            merchantAccountId: merchantResolution.snapshot.merchantAccountId,
            beneficiaryType: merchantResolution.snapshot.beneficiaryType,
            commercialSnapshot: merchantResolution.snapshot,
        });
        return checkout;
    });
}

export async function getStoredPaymentCheckoutForOrder(orderId: string, userId: string) {
    if (!isPostgresDatabaseEnabled()) throw new BillingInputError("支付下单需要启用 PostgreSQL", 501);
    return withPostgresTransaction(async (client) => {
        const order = await createPostgresRepositories(client).billing.getOrderById(normalizeId(orderId), false);
        assertPayableOrder(order, userId);
        const provider = normalizeProvider(order.provider);
        const checkout = checkoutFromMetadata(order, provider);
        if (!checkout) throw new BillingInputError("支付参数不存在或已过期，请重新发起支付", 409);
        return checkout;
    });
}

export function resolveCheckoutProvider(orderProvider: unknown, requestedProvider: unknown) {
    const provider = normalizeProvider(orderProvider);
    const requested = requestedProvider === undefined || requestedProvider === null || requestedProvider === "" ? provider : normalizeProvider(requestedProvider);
    if (requested !== provider) throw new BillingInputError("订单支付渠道已锁定，请重新创建订单后更换渠道", 409);
    return provider;
}

function assertPayableOrder(order: Awaited<ReturnType<ReturnType<typeof createPostgresRepositories>["billing"]["getOrderById"]>>, userId?: string, tenantId?: string): asserts order is NonNullable<typeof order> {
    if (!order || (userId && order.userId !== userId)) throw new BillingInputError("订单不存在", 404);
    if (isAutomaticallyExpiredOrder(order) || (order.expiresAt && Date.parse(order.expiresAt) <= Date.now())) throw new BillingInputError("订单已过期", 409);
    if (order.status !== "pending") throw new BillingInputError("当前订单状态不能发起支付", 409);
}
export function assertCheckoutMerchantRequest(
    persisted: { merchantAccountId?: string; collectionMode?: "platform" | "tenant" },
    requested: { merchantAccountId?: string; collectionMode?: "platform" | "tenant" },
) {
    if (requested.merchantAccountId && persisted.merchantAccountId && requested.merchantAccountId !== persisted.merchantAccountId) {
        throw new BillingInputError("Merchant account is locked to the order", 409, "MERCHANT_ACCOUNT_LINEAGE_MISMATCH");
    }
    if (requested.collectionMode && persisted.collectionMode && requested.collectionMode !== persisted.collectionMode) {
        throw new BillingInputError("Collection mode is locked to the order", 409, "MERCHANT_ACCOUNT_LINEAGE_MISMATCH");
    }
}

function assertOrderTenant(order: { tenantId?: string }, tenantId?: string) {
    if (tenantId && order.tenantId && order.tenantId !== tenantId) {
        throw new BillingInputError("Order does not belong to the tenant", 404, "TENANT_ORDER_NOT_FOUND");
    }
}

async function resolveCheckoutMerchant(
    repos: ReturnType<typeof createPostgresRepositories>,
    order: Awaited<ReturnType<ReturnType<typeof createPostgresRepositories>["billing"]["getOrderById"]>>,
    provider: string,
    options: CreatePaymentCheckoutOptions,
) {
    const storedSnapshot = readCommercialSnapshot(order?.commercialSnapshot);
    const collectionMode = order?.collectionMode || storedSnapshot?.collectionMode || "platform";
    const merchantAccountId = order?.merchantAccountId || storedSnapshot?.merchantAccountId;
    assertCheckoutMerchantRequest(
        { merchantAccountId, collectionMode },
        { merchantAccountId: options.merchantAccountId, collectionMode: options.collectionMode },
    );

    const tenantId = order?.tenantId || storedSnapshot?.tenantId || options.tenantId || "default";
    const scope =
        collectionMode === "tenant"
            ? { ownerType: "tenant" as const, ownerId: tenantId, tenantId }
            : { ownerType: "platform" as const, ownerId: "platform" };
    const merchant = await new MerchantAccountService(repos.merchantAccounts).resolveForCheckout({
        id: merchantAccountId,
        scope,
        provider,
        environment: paymentMerchantEnvironment(),
    });
    const snapshot: CommercialOrderSnapshot = storedSnapshot || {
        tenantId,
        collectionMode,
        merchantAccountId: merchant.id,
        beneficiaryType: "tenant",
        currency: order?.currency || "CNY",
        tenantSaleAmount: order?.amountCents || 0,
        platformCostAmount: 0,
        product: { id: order?.productId || "", name: order?.subject || "" },
    };
    return { merchant, snapshot: { ...snapshot, merchantAccountId: merchant.id } };
}

function readCommercialSnapshot(value: unknown): CommercialOrderSnapshot | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const source = value as Record<string, unknown>;
    if (
        typeof source.tenantId !== "string" ||
        (source.collectionMode !== "platform" && source.collectionMode !== "tenant") ||
        typeof source.merchantAccountId !== "string" ||
        (source.beneficiaryType !== "platform" && source.beneficiaryType !== "tenant") ||
        typeof source.currency !== "string" ||
        typeof source.tenantSaleAmount !== "number" ||
        typeof source.platformCostAmount !== "number" ||
        !source.product ||
        typeof source.product !== "object" ||
        Array.isArray(source.product)
    ) {
        return undefined;
    }
    const product = source.product as Record<string, unknown>;
    if (typeof product.id !== "string" || typeof product.name !== "string") return undefined;
    return {
        tenantId: source.tenantId,
        collectionMode: source.collectionMode,
        merchantAccountId: source.merchantAccountId,
        beneficiaryType: source.beneficiaryType,
        currency: source.currency,
        tenantSaleAmount: source.tenantSaleAmount,
        platformCostAmount: source.platformCostAmount,
        product: { id: product.id, name: product.name },
    };
}
