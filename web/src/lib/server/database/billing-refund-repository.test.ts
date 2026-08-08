import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "./postgres";
import { BillingRefundRepository, type BillingRefundJobRecord } from "./billing-refund-repository";

describe("BillingRefundRepository", () => {
    it("persists tenant and merchant lineage for a refund job", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [
                {
                    id: "refund-job-one",
                    order_id: "order-one",
                    payment_id: "payment-one",
                    tenant_id: "tenant-a",
                    merchant_account_id: "merchant-a",
                    provider: "stripe",
                    status: "pending",
                    attempts: 1,
                    max_attempts: 8,
                    created_at: "2026-08-08T00:00:00.000Z",
                    updated_at: "2026-08-08T00:00:00.000Z",
                },
            ],
        });
        const repository = new BillingRefundRepository({ query } as unknown as QueryExecutor);

        const result = await repository.upsert({
            id: "refund-job-one",
            orderId: "order-one",
            paymentId: "payment-one",
            tenantId: "tenant-a",
            merchantAccountId: "merchant-a",
            provider: "stripe",
            status: "pending",
            attempts: 1,
            maxAttempts: 8,
            createdAt: "2026-08-08T00:00:00.000Z",
            updatedAt: "2026-08-08T00:00:00.000Z",
        } satisfies BillingRefundJobRecord);

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("tenant_id, merchant_account_id"),
            expect.arrayContaining(["tenant-a", "merchant-a"]),
        );
        expect(result).toMatchObject({ tenantId: "tenant-a", merchantAccountId: "merchant-a" });
    });
});
