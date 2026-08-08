import type { QueryExecutor } from "@/lib/server/database/postgres";
import { createPostgresRepositories, type BillingOrderRecord, type PaymentTransactionRecord } from "@/lib/server/database";
import type { PaymentRefundResult } from "@/lib/server/payment-refund-service";

const settlementCreditKey = (orderId: string) => `billing-order:${orderId}:tenant-settlement-credit`;

export async function creditTenantSettlementReceivable(client: QueryExecutor, order: BillingOrderRecord, payment: PaymentTransactionRecord) {
    if (order.collectionMode === "tenant" || !order.tenantId || order.amountCents <= 0) return undefined;
    const repository = createPostgresRepositories(client).tenantSettlement;
    const account = await repository.getOrCreateAccount({
        tenantId: order.tenantId,
        currency: order.currency,
        now: timestamp(payment.paidAt || order.paidAt),
    });
    return repository.credit({
        tenantId: order.tenantId,
        accountId: account.id,
        amount: order.amountCents,
        referenceType: "billing-order",
        referenceId: order.id,
        idempotencyKey: settlementCreditKey(order.id),
        metadata: {
            orderNo: order.orderNo,
            paymentId: payment.id,
            merchantAccountId: order.merchantAccountId || "",
            collectionMode: "platform",
            currency: order.currency,
        },
    });
}

export async function reverseTenantSettlementReceivable(
    client: QueryExecutor,
    order: BillingOrderRecord,
    providerRefund: PaymentRefundResult,
    amountCents = providerRefund.amountCents || order.amountCents,
    refundReferenceIdOverride?: string,
) {
    if (order.collectionMode === "tenant" || !order.tenantId || order.amountCents <= 0) return undefined;
    const repository = createPostgresRepositories(client).tenantSettlement;
    const account = await repository.getOrCreateAccount({
        tenantId: order.tenantId,
        currency: order.currency,
    });
    const original = await repository.getEntryByIdempotencyKey(order.tenantId, account.id, settlementCreditKey(order.id));
    if (!original) return undefined;

    const refundReferenceId = refundReferenceIdOverride || providerRefund.providerRefundId || `${providerRefund.provider}:${order.id}`;
    return repository.reverse({
        tenantId: order.tenantId,
        accountId: account.id,
        amount: Math.min(original.amount, amountCents),
        referenceType: "billing-refund",
        referenceId: refundReferenceId,
        idempotencyKey: `billing-refund:${providerRefund.provider}:${refundReferenceId}:tenant-settlement-reversal`,
        originalEntryId: original.id,
        metadata: {
            orderId: order.id,
            orderNo: order.orderNo,
            merchantAccountId: order.merchantAccountId || "",
            collectionMode: "platform",
            currency: order.currency,
            provider: providerRefund.provider,
            providerRefundId: providerRefund.providerRefundId || "",
        },
    });
}

function timestamp(value?: string) {
    const parsed = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : Date.now();
}
