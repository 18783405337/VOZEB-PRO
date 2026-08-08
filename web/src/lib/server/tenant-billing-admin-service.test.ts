import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createPostgresRepositories: vi.fn(),
    listMerchants: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: mocks.createPostgresRepositories,
}));

vi.mock("@/lib/server/payment/merchant-account-service", () => ({
    MerchantAccountService: class {
        list = mocks.listMerchants;
    },
}));

import { getTenantBillingOverview } from "./tenant-billing-admin-service";

describe("tenant billing admin service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createPostgresRepositories.mockReturnValue({
            tenantWallet: { listAccounts: vi.fn().mockResolvedValue([{ id: "wallet-a" }]) },
            tenantPower: { listAccounts: vi.fn().mockResolvedValue([{ id: "power-a" }]) },
            tenantSettlement: { listAccounts: vi.fn().mockResolvedValue([{ id: "settlement-a" }]) },
            taskBilling: {},
            merchantAccounts: {},
            billing: {
                listOrders: vi.fn().mockResolvedValue({ items: [{ id: "order-a" }], total: 1, page: 1, pageSize: 20 }),
                listReconciliationRuns: vi.fn().mockResolvedValue({ items: [{ id: "run-a" }], total: 1, page: 1, pageSize: 10 }),
            },
        });
        mocks.listMerchants.mockResolvedValue([{ id: "merchant-a" }]);
    });

    it("loads every billing view with the trusted tenant scope", async () => {
        const result = await getTenantBillingOverview("tenant-a");
        const repositories = mocks.createPostgresRepositories.mock.results[0]?.value;

        expect(result).toMatchObject({
            wallets: [{ id: "wallet-a" }],
            power: [{ id: "power-a" }],
            settlement: [{ id: "settlement-a" }],
            orders: { items: [{ id: "order-a" }] },
            merchants: [{ id: "merchant-a" }],
            reconciliation: { items: [{ id: "run-a" }] },
        });
        expect(repositories.tenantWallet.listAccounts).toHaveBeenCalledWith("tenant-a");
        expect(repositories.tenantPower.listAccounts).toHaveBeenCalledWith("tenant-a");
        expect(repositories.tenantSettlement.listAccounts).toHaveBeenCalledWith("tenant-a");
        expect(repositories.billing.listOrders).toHaveBeenCalledWith({ tenantId: "tenant-a", page: 1, pageSize: 20 });
        expect(repositories.billing.listReconciliationRuns).toHaveBeenCalledWith({ tenantId: "tenant-a", page: 1, pageSize: 10 });
        expect(mocks.listMerchants).toHaveBeenCalledWith({ ownerType: "tenant", ownerId: "tenant-a", tenantId: "tenant-a" });
    });
});
