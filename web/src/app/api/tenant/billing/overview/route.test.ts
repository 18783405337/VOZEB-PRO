import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireTenantPermission: vi.fn(),
    getTenantBillingOverview: vi.fn(),
    isSaasEnabled: vi.fn(),
    isSaasBillingEnabled: vi.fn(),
    isPostgresDatabaseEnabled: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({ requireTenantPermission: mocks.requireTenantPermission }));
vi.mock("@/lib/server/tenant-billing-admin-service", () => ({ getTenantBillingOverview: mocks.getTenantBillingOverview }));
vi.mock("@/lib/server/tenant/saas-feature", () => ({ isSaasEnabled: mocks.isSaasEnabled, isSaasBillingEnabled: mocks.isSaasBillingEnabled }));
vi.mock("@/lib/server/database", () => ({ isPostgresDatabaseEnabled: mocks.isPostgresDatabaseEnabled }));

import { GET } from "./route";

describe("tenant billing overview API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isSaasEnabled.mockReturnValue(true);
        mocks.isSaasBillingEnabled.mockReturnValue(true);
        mocks.isPostgresDatabaseEnabled.mockReturnValue(true);
        mocks.requireTenantPermission.mockResolvedValue({ tenant: { id: "tenant-a" } });
        mocks.getTenantBillingOverview.mockResolvedValue({
            wallets: [],
            power: [],
            settlement: [],
            orders: { items: [], total: 0, page: 1, pageSize: 20 },
            merchants: [],
            reconciliation: { items: [], total: 0, page: 1, pageSize: 10 },
            generatedAt: "2026-08-08T00:00:00.000Z",
        });
    });

    it("returns only the overview for the trusted tenant context", async () => {
        const response = await GET(new Request("https://tenant.example.com/api/tenant/billing/overview?tenantId=tenant-b"));

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Request), "tenant.billing.read");
        expect(mocks.getTenantBillingOverview).toHaveBeenCalledWith("tenant-a");
    });

    it("requires SaaS PostgreSQL for the tenant billing overview", async () => {
        mocks.isPostgresDatabaseEnabled.mockReturnValue(false);

        const response = await GET(new Request("https://tenant.example.com/api/tenant/billing/overview"));

        expect(response.status).toBe(501);
        expect(mocks.requireTenantPermission).not.toHaveBeenCalled();
    });

    it("keeps tenant billing administration behind the billing rollout flag", async () => {
        mocks.isSaasBillingEnabled.mockReturnValue(false);

        const response = await GET(new Request("https://tenant.example.com/api/tenant/billing/overview"));

        expect(response.status).toBe(501);
        expect(mocks.requireTenantPermission).not.toHaveBeenCalled();
    });
});
