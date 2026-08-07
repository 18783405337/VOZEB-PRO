import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    audit: vi.fn(),
    auditActorFromRequest: vi.fn(() => ({ id: "admin-one" })),
    getById: vi.fn(),
    requirePlatformPermission: vi.fn(),
    updateName: vi.fn(),
    updateStatus: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: class AuthorizationError extends Error {},
    requirePlatformPermission: mocks.requirePlatformPermission,
}));

vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: () => ({
        tenants: {
            getById: mocks.getById,
            updateName: mocks.updateName,
            updateStatus: mocks.updateStatus,
        },
    }),
}));

vi.mock("@/lib/server/audit-log-store", () => ({
    auditActorFromRequest: mocks.auditActorFromRequest,
    safeRecordAuditLog: mocks.audit,
}));

import { PATCH } from "./route";

describe("platform tenant detail API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requirePlatformPermission.mockResolvedValue({ user: { id: "admin-one", username: "admin", role: "admin" } });
        mocks.getById.mockResolvedValue({ id: "tenant-a", slug: "tenant-a", name: "Tenant A", status: "active" });
        mocks.updateName.mockResolvedValue({ id: "tenant-a", slug: "tenant-a", name: "Renamed", status: "active" });
        mocks.updateStatus.mockResolvedValue({ id: "tenant-a", slug: "tenant-a", name: "Tenant A", status: "disabled" });
    });

    it("renames a tenant and records a profile audit event", async () => {
        const response = await PATCH(request({ name: "Renamed" }), context());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ code: 0, data: { tenant: { name: "Renamed" } } });
        expect(mocks.updateName).toHaveBeenCalledWith("tenant-a", "Renamed");
        expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.tenant.update" }));
    });

    it("disables a tenant and records a status audit event", async () => {
        const response = await PATCH(request({ status: "disabled" }), context());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ code: 0, data: { tenant: { status: "disabled" } } });
        expect(mocks.updateStatus).toHaveBeenCalledWith("tenant-a", "disabled");
        expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.tenant.status", metadata: expect.objectContaining({ status: "disabled" }) }));
    });

    it("returns not found without applying updates", async () => {
        mocks.getById.mockResolvedValue(null);

        const response = await PATCH(request({ name: "Renamed" }), context());

        expect(response.status).toBe(404);
        expect(mocks.updateName).not.toHaveBeenCalled();
        expect(mocks.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects requests without a supported change", async () => {
        const response = await PATCH(request({ status: "pending" }), context());

        expect(response.status).toBe(400);
        expect(mocks.updateName).not.toHaveBeenCalled();
        expect(mocks.updateStatus).not.toHaveBeenCalled();
    });
});

function request(body: object) {
    return new Request("http://localhost/api/admin/tenants/tenant-a", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

function context() {
    return { params: Promise.resolve({ id: "tenant-a" }) };
}
