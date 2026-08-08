import { lockAuthMutation } from "@/lib/server/auth-mutation-lock";
import { refundBillingOrderCoupon } from "@/lib/server/billing-commerce-service";
import { BillingInputError } from "@/lib/server/billing-errors";
import { reverseTenantSettlementReceivable } from "@/lib/server/billing-settlement-service";
import { createPostgresRepositories, withPostgresTransaction, type JsonValue, type PaymentTransactionRecord } from "@/lib/server/database";
import { adjustPermanentPointsInPostgresTransaction } from "@/lib/server/points-wallet-service";
import { reverseReferralRewardsForRefundedOrder } from "@/lib/server/referral-service";
import { buildRefundedOrderResult, mergeJson, paymentRefundMetadata, readRefundSummary, sanitizeJson } from "@/lib/server/billing-service-helpers";
import type { PaymentRefundResult } from "@/lib/server/payment-refund-service";

export type BillingRefundFinalizationInput = {
    orderId: string;
    paymentId?: string;
    reason: string;
    operatorUserId: string;
    amountCents: number;
    refundRequestId: string;
    cumulativeBeforeCents: number;
    cumulativeAfterCents: number;
    providerRefund: PaymentRefundResult;
    rawPayload?: unknown;
};

export async function finalizeBillingOrderRefund(input: BillingRefundFinalizationInput) {
    return withPostgresTransaction(async (client) => {
        await lockAuthMutation(client);
        const repos = createPostgresRepositories(client);
        const order = await repos.billing.getOrderById(input.orderId, true);
        if (!order) throw new BillingInputError("订单不存在", 404);
        if (order.status === "refunded") return buildRefundedOrderResult(order, client);
        if (order.status !== "refunding") throw new BillingInputError("退款状态已变化，请刷新后重试", 409);
        if (!order.userId) throw new BillingInputError("订单没有绑定用户", 409);

        const payments = await repos.billing.listPayments({ orderId: order.id, page: 1, pageSize: 100 });
        const payment = payments.items.find((item) => item.id === input.paymentId) || payments.items.find((item) => item.status === "succeeded" || item.status === "refunded");
        const user = await repos.users.getById(order.userId);
        if (!user) throw new BillingInputError("订单用户不存在", 404);
        const now = new Date().toISOString();
        const fullRefund = input.cumulativeAfterCents >= order.amountCents;
        if (fullRefund) await refundBillingOrderCoupon(client, order, now);

        const refundedPayment = payment ? await markPaymentRefunded(payment, input, now, repos.billing.updatePaymentState, fullRefund) : undefined;
        const settlementReversal = await reverseTenantSettlementReceivable(client, order, input.providerRefund, input.amountCents, input.refundRequestId);
        const assignments = order.productKind === "plan" ? await repos.billing.listPlanAssignments({ userId: order.userId, source: "order", page: 1, pageSize: 100 }) : undefined;
        const assignment = assignments?.items.find((item) => item.sourceId === order.id);
        const canceledAssignment = fullRefund && assignment
            ? await repos.billing.updatePlanAssignment(assignment.id, {
                  status: "canceled",
                  endsAt: now,
                  metadata: mergeJson(assignment.metadata, { refund: { reason: input.reason, refundedAt: now } }),
              })
            : undefined;

        const previousPointsReversed = readRefundSummary(order.metadata).pointsReversed;
        const targetPointsReversed = fullRefund ? order.pointsAmount : Number(((order.pointsAmount * input.cumulativeAfterCents) / order.amountCents).toFixed(2));
        const pointsDelta = Math.max(0, targetPointsReversed - previousPointsReversed);
        const walletAdjustment = pointsDelta
            ? await adjustPermanentPointsInPostgresTransaction(client, {
                  userId: user.id,
                  amount: -pointsDelta,
                  description: `订单退款：${order.subject}`,
                  idempotencyKey: `billing-order:${order.id}:refund:${input.refundRequestId}`,
                  type: "admin-adjust",
                  requireActive: false,
                  now: new Date(now),
              })
            : null;
        const pointsReversed = previousPointsReversed + Math.max(0, -(walletAdjustment?.record.amount || 0));
        if (fullRefund) await reverseReferralRewardsForRefundedOrder(client, { orderId: order.id, refundedAt: now, reason: input.reason });

        let updatedUser = user;
        if (order.productKind === "plan") {
            const activeAssignment = await repos.billing.getActivePlanAssignment(user.id, new Date(now));
            const settings = await repos.settings.getSettings();
            const planUser = await repos.users.update(user.id, { planId: activeAssignment?.planId || settings.settings?.defaultPlanId || "free" });
            if (!planUser) throw new BillingInputError("订单用户不存在", 404);
            updatedUser = planUser;
        } else {
            const refreshed = await repos.users.getById(user.id);
            if (!refreshed) throw new BillingInputError("订单用户不存在", 404);
            updatedUser = refreshed;
        }

        const updatedOrder = await repos.billing.updateOrder(order.id, {
            status: fullRefund ? "refunded" : "partially_refunded",
            closedAt: fullRefund ? now : undefined,
            metadata: mergeJson(order.metadata, {
                refund: {
                    reason: input.reason,
                    operatorUserId: input.operatorUserId,
                    refundedAt: now,
                    amountCents: input.amountCents,
                    refundedAmountCents: input.cumulativeAfterCents,
                    remainingAmountCents: Math.max(0, order.amountCents - input.cumulativeAfterCents),
                    refundRequestId: input.refundRequestId,
                    refundCount: readRefundCount(order.metadata) + 1,
                    pointsReversed,
                    settlementReversalId: settlementReversal?.entry.id || "",
                    settlementReversedCents: settlementReversal?.entry.amount || 0,
                    providerRefund: paymentRefundMetadata(input.providerRefund, false),
                },
            }),
        });
        if (!updatedOrder) throw new BillingInputError("订单不存在", 404);
        return { order: updatedOrder, payment: refundedPayment, assignment: canceledAssignment, user: updatedUser, pointsReversed, providerRefund: input.providerRefund };
    });
}

async function markPaymentRefunded(
    payment: PaymentTransactionRecord,
    input: BillingRefundFinalizationInput,
    now: string,
    upsert: (payment: PaymentTransactionRecord) => Promise<PaymentTransactionRecord>,
    fullRefund: boolean,
) {
    return upsert({
        ...payment,
        status: fullRefund ? "refunded" : payment.status,
        rawPayload: mergeJson(payment.rawPayload, {
            refund: {
                reason: input.reason,
                operatorUserId: input.operatorUserId,
                refundedAt: now,
                rawPayload: sanitizeJson(input.rawPayload) as JsonValue,
                providerRefund: paymentRefundMetadata(input.providerRefund, true),
            },
        }),
        refundedAt: fullRefund ? now : payment.refundedAt,
        updatedAt: now,
    });
}

function readRefundCount(metadata: JsonValue | undefined) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
    const refund = (metadata as Record<string, JsonValue>).refund;
    if (!refund || typeof refund !== "object" || Array.isArray(refund)) return 0;
    return Math.max(0, Math.floor(Number((refund as Record<string, JsonValue>).refundCount) || 0));
}
