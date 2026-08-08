import { normalizePaymentProvider } from "@/lib/payment-provider";
import type { BillingOrderRecord } from "@/lib/server/database";
import { createPostgresRepositories } from "@/lib/server/database";
import { bootstrapLegacyPaymentMerchantAccounts, buildPaymentRuntimeConfigFromMerchant, getPaymentRuntimeConfig, paymentMerchantEnvironment, type PaymentRuntimeConfig } from "@/lib/server/payment-config-store";
import { MerchantAccountService, type ResolvedMerchantAccount } from "@/lib/server/payment/merchant-account-service";
import { normalizeId } from "@/lib/server/billing-service-helpers";

export type PaymentMerchantRuntime = {
    merchant: ResolvedMerchantAccount;
    config: PaymentRuntimeConfig;
};

export async function resolvePaymentMerchantRuntime(input: { order: Pick<BillingOrderRecord, "id" | "tenantId" | "provider" | "merchantAccountId" | "collectionMode">; provider?: string }) {
    const runtimeConfig = await getPaymentRuntimeConfig();
    await bootstrapLegacyPaymentMerchantAccounts({ runtimeConfig });

    const provider = normalizePaymentProvider(input.provider || input.order.provider);
    const tenantId = normalizeId(input.order.tenantId) || "default";
    const collectionMode = input.order.collectionMode === "tenant" ? "tenant" : "platform";
    const scope =
        collectionMode === "tenant"
            ? { ownerType: "tenant" as const, ownerId: tenantId, tenantId }
            : { ownerType: "platform" as const, ownerId: "platform" };
    const merchant = await new MerchantAccountService(createPostgresRepositories().merchantAccounts).resolveForCheckout({
        id: input.order.merchantAccountId,
        scope,
        provider,
        environment: paymentMerchantEnvironment(),
    });

    return {
        merchant,
        config: buildPaymentRuntimeConfigFromMerchant(merchant),
    } satisfies PaymentMerchantRuntime;
}

export async function resolvePaymentWebhookMerchantRuntime(input: {
    provider: string;
    environment: "test" | "production";
    webhookIdentity: string;
}) {
    const merchant = await new MerchantAccountService(createPostgresRepositories().merchantAccounts).resolveForWebhook(input);
    return {
        merchant,
        config: buildPaymentRuntimeConfigFromMerchant(merchant),
    } satisfies PaymentMerchantRuntime;
}
