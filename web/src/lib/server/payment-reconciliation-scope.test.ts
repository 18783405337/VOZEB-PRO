import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createPostgresRepositories: vi.fn(),
    ensurePostgresSchema: vi.fn(),
    isPostgresDatabaseEnabled: vi.fn(),
    listReconciliationRuns: vi.fn(),
    getReconciliationRun: vi.fn(),
    getReconciliationRunByFileHash: vi.fn(),
    listReconciliationRows: vi.fn(),
    getOrderByOrderNo: vi.fn(),
    getOrderById: vi.fn(),
    listOrders: vi.fn(),
    listPayments: vi.fn(),
    getPaymentByProviderIdentifier: vi.fn(),
    createReconciliationRun: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: mocks.createPostgresRepositories,
    ensurePostgresSchema: mocks.ensurePostgresSchema,
    isPostgresDatabaseEnabled: mocks.isPostgresDatabaseEnabled,
    withPostgresTransaction: vi.fn(async (callback: (client: unknown) => unknown) => callback("transaction")),
}));

import { getBillingReconciliationRun, importBillingStatement, listBillingReconciliationRuns, reconcileBillingStatement } from "./payment-reconciliation-service";

const tenantOrder = {
    id: "order-tenant-a",
    orderNo: "VZ001",
    tenantId: "tenant-a",
    merchantAccountId: "merchant-a",
    collectionMode: "tenant",
    provider: "stripe",
    status: "paid",
    amountCents: 1990,
    currency: "CNY",
};

describe("scoped payment reconciliation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isPostgresDatabaseEnabled.mockReturnValue(true);
        mocks.ensurePostgresSchema.mockResolvedValue(undefined);
        mocks.createPostgresRepositories.mockImplementation(() => ({
            billing: {
                listReconciliationRuns: mocks.listReconciliationRuns,
                getReconciliationRun: mocks.getReconciliationRun,
                getReconciliationRunByFileHash: mocks.getReconciliationRunByFileHash,
                listReconciliationRows: mocks.listReconciliationRows,
                getOrderByOrderNo: mocks.getOrderByOrderNo,
                getOrderById: mocks.getOrderById,
                listOrders: mocks.listOrders,
                listPayments: mocks.listPayments,
                getPaymentByProviderIdentifier: mocks.getPaymentByProviderIdentifier,
                createReconciliationRun: mocks.createReconciliationRun,
            },
        }));
        mocks.listReconciliationRuns.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
        mocks.getReconciliationRun.mockResolvedValue(null);
        mocks.getReconciliationRunByFileHash.mockResolvedValue(null);
        mocks.listOrders.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
        mocks.listPayments.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
        mocks.getPaymentByProviderIdentifier.mockResolvedValue(null);
        mocks.getOrderById.mockResolvedValue(null);
        mocks.createReconciliationRun.mockResolvedValue({ id: "run-one" });
    });

    it("passes the tenant scope to reconciliation run listing and lookup", async () => {
        await listBillingReconciliationRuns({ provider: "stripe" }, { tenantId: "tenant-a" });
        await getBillingReconciliationRun("run-one", { tenantId: "tenant-a" });

        expect(mocks.listReconciliationRuns).toHaveBeenCalledWith(expect.objectContaining({ provider: "stripe", tenantId: "tenant-a" }));
        expect(mocks.getReconciliationRun).toHaveBeenCalledWith("run-one", "tenant-a");
    });

    it("does not match a cross-tenant order during tenant reconciliation", async () => {
        mocks.getOrderByOrderNo.mockResolvedValue({ ...tenantOrder, tenantId: "tenant-b" });

        const result = await reconcileBillingStatement(
            { provider: "stripe", csvText: "order_no,amount,currency,status\nVZ001,19.90,CNY,succeeded" },
            { tenantId: "tenant-a" },
        );

        expect(result.rows[0]?.localOrderId).toBeUndefined();
        expect(result.rows[0]?.issueCodes).toContain("missing_local_order");
        expect(mocks.listOrders).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a" }));
    });

    it("uses a tenant-scoped file hash and persists the tenant lineage", async () => {
        const result = await importBillingStatement(
            {
                provider: "stripe",
                csvText: "order_no,amount,currency,status\nVZ404,19.90,CNY,succeeded",
                fileName: "statement.csv",
            },
            { userId: "user-a", username: "tenant-admin" },
            { tenantId: "tenant-a" },
        );

        expect(mocks.getReconciliationRunByFileHash).toHaveBeenCalledWith("stripe", expect.any(String), "tenant-a");
        expect(mocks.createReconciliationRun).toHaveBeenCalledWith(
            expect.objectContaining({ tenantId: "tenant-a" }),
            expect.arrayContaining([expect.objectContaining({ tenantId: "tenant-a" })]),
        );
        expect(result.runId).toBeTruthy();
    });
});
