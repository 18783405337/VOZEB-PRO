import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "@/lib/server/database/postgres";
import { BillingPaymentRepository } from "./billing-payment-repository";

describe("BillingPaymentRepository payment identity scope", () => {
    it("locks provider identifiers inside the merchant and tenant scope", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const repository = new BillingPaymentRepository({ query } as QueryExecutor);

        await repository.lockPaymentIdentity("stripe", ["pi-shared"], {
            tenantId: "tenant-a",
            merchantAccountId: "merchant-a",
        });

        expect(query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
            "tenant:tenant-a:merchant:merchant-a:stripe:pi-shared",
        ]);
    });

    it("filters payment identity lookup by tenant and merchant", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const repository = new BillingPaymentRepository({ query } as QueryExecutor);

        await repository.getPaymentByProviderIdentifiers("stripe", ["pi-shared"], {
            tenantId: "tenant-a",
            merchantAccountId: "merchant-a",
            forUpdate: true,
        });

        const [sql, values] = query.mock.calls[0] || [];
        expect(sql).toContain("tenant_id IS NOT DISTINCT FROM $3::text");
        expect(sql).toContain("merchant_account_id IS NOT DISTINCT FROM $4::text");
        expect(sql).toContain("FOR UPDATE");
        expect(values).toEqual(["stripe", ["pi-shared"], "tenant-a", "merchant-a"]);
    });
});
