import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    audit: vi.fn(),
    auditActorFromRequest: vi.fn(() => ({ id: "admin-one" })),
    getById: vi.fn(),
    requirePlatformPermission: vi.fn(),
    transferOwner: vi.fn(),
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
            transferOwner: mocks.transferOwner,
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

const originalSaasEnabled = process.env.VOZEB_PRO_SAAS_ENABLED;

describe("platform tenant detail API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_SAAS_ENABLED = "1";
        mocks.requirePlatformPermission.mockResolvedValue({ user: { id: "admin-one", username: "admin", role: "admin" } });
        mocks.getById.mockResolvedValue({ id: "tenant-a", slug: "tenant-a", name: "Tenant A", status: "active", ownerUserId: "owner-one" });
        mocks.transferOwner.mockResolvedValue({ id: "tenant-a", slug: "tenant-a", name: "Tenant A", status: "active", ownerUserId: "owner-two" });
        mocks.updateName.mockResolvedValue({ id: "tenant-a", slug: "tenant-a", name: "Renamed", status: "active" });
        mocks.updateStatus.mockResolvedValue({ id: "tenant-a", slug: "tenant-a", name: "Tenant A", status: "disabled" });
    });

    afterEach(() => {
        if (originalSaasEnabled === undefined) delete process.env.VOZEB_PRO_SAAS_ENABLED;
        else process.env.VOZEB_PRO_SAAS_ENABLED = originalSaasEnabled;
    });

    it("returns 501 before authorization when SaaS administration is disabled", async () => {
        process.env.VOZEB_PRO_SAAS_ENABLED = "0";

        const response = await PATCH(request({ name: "Renamed" }), context());

        expect(response.status).toBe(501);
        expect(mocks.requirePlatformPermission).not.toHaveBeenCalled();
        expect(mocks.getById).not.toHaveBeenCalled();
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

    it("transfers tenant ownership and records the previous owner", async () => {
        const response = await PATCH(request({ ownerUserId: "owner-two" }), context());

        expect(response.status).toBe(200);
        expect(mocks.transferOwner).toHaveBeenCalledWith("tenant-a", "owner-two");
        expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
            action: "platform.tenant.owner.transfer",
            metadata: { ownerUserId: "owner-two", previousOwnerUserId: "owner-one" },
        }));
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
