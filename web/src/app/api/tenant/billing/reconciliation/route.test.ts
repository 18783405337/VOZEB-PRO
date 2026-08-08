import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireTenantPermission: vi.fn(),
    listBillingReconciliationRuns: vi.fn(),
    getBillingReconciliationRun: vi.fn(),
    importBillingStatement: vi.fn(),
    audit: vi.fn(),
    auditActorFromRequest: vi.fn(() => ({ id: "user-a" })),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({ requireTenantPermission: mocks.requireTenantPermission }));
vi.mock("@/lib/server/payment-reconciliation-service", () => ({
    listBillingReconciliationRuns: mocks.listBillingReconciliationRuns,
    getBillingReconciliationRun: mocks.getBillingReconciliationRun,
    importBillingStatement: mocks.importBillingStatement,
}));
vi.mock("@/lib/server/audit-log-store", () => ({
    safeRecordAuditLog: mocks.audit,
    auditActorFromRequest: mocks.auditActorFromRequest,
}));

import { GET, POST } from "./route";

describe("tenant billing reconciliation API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireTenantPermission.mockResolvedValue({ tenant: { id: "tenant-a" }, user: { id: "user-a", username: "tenant-admin" } });
        mocks.listBillingReconciliationRuns.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
        mocks.getBillingReconciliationRun.mockResolvedValue({ runId: "run-a", provider: "stripe", rows: [], groups: [] });
        mocks.importBillingStatement.mockResolvedValue({ runId: "run-a", provider: "stripe", issueRows: 0 });
    });

    it("lists and reads only the resolved tenant scope", async () => {
        const listResponse = await GET(new Request("https://example.com/api/tenant/billing/reconciliation?page=2"));
        const detailResponse = await GET(new Request("https://example.com/api/tenant/billing/reconciliation?runId=run-a"));

        expect(listResponse.status).toBe(200);
        expect(detailResponse.status).toBe(200);
        expect(mocks.listBillingReconciliationRuns).toHaveBeenCalledWith(expect.any(Object), { tenantId: "tenant-a" });
        expect(mocks.getBillingReconciliationRun).toHaveBeenCalledWith("run-a", { tenantId: "tenant-a" });
    });

    it("strips client tenant fields and persists the trusted tenant scope", async () => {
        const request = new Request("https://example.com/api/tenant/billing/reconciliation", {
            method: "POST",
            body: JSON.stringify({ tenantId: "tenant-b", provider: "stripe", csvText: "order_no,amount,currency,status\nVZ001,19.90,CNY,succeeded" }),
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
        expect(mocks.importBillingStatement).toHaveBeenCalledWith(
            expect.objectContaining({ provider: "stripe" }),
            { userId: "user-a", username: "tenant-admin" },
            { tenantId: "tenant-a" },
        );
        expect(mocks.importBillingStatement.mock.calls[0]?.[0]).not.toHaveProperty("tenantId");
        expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "tenant.billing.reconciliation.import" }));
    });
});
