import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tenant billing administration", () => {
    it("guards the page with trusted tenant billing permission", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/tenant-admin/billing/page.tsx"), "utf8");

        expect(source).toContain("getTenantPageContext");
        expect(source).toContain("tenant.billing.read");
        expect(source).toContain("isSaasBillingEnabled");
        expect(source).toContain("TenantBillingClient");
    });

    it("provides the six scoped billing views without exposing merchant credentials", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/tenant-admin/billing/components/tenant-billing-client.tsx"), "utf8");

        for (const view of ["wallets", "power", "settlement", "orders", "merchants", "reconciliation"]) {
            expect(source).toContain(`key: "${view}"`);
        }
        expect(source).toContain("configuredFields");
        expect(source).toContain("environment");
        expect(source).not.toContain("credentials");
    });
});
