import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    audit: vi.fn(),
    auditActorFromRequest: vi.fn(() => ({ id: "admin-one" })),
    createWithOwner: vi.fn(),
    list: vi.fn(),
    requirePlatformPermission: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: class AuthorizationError extends Error {},
    requirePlatformPermission: mocks.requirePlatformPermission,
}));

vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: () => ({
        tenants: {
            createWithOwner: mocks.createWithOwner,
            list: mocks.list,
        },
    }),
}));

vi.mock("@/lib/server/audit-log-store", () => ({
    auditActorFromRequest: mocks.auditActorFromRequest,
    safeRecordAuditLog: mocks.audit,
}));

import { GET, POST } from "./route";

describe("platform tenant collection API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requirePlatformPermission.mockResolvedValue({ user: { id: "admin-one", username: "admin", role: "admin" } });
        mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
        mocks.createWithOwner.mockResolvedValue({ id: "tenant-a", slug: "tenant-a", name: "Tenant A", status: "active" });
    });

    it("lists tenants through the platform read permission", async () => {
        const response = await GET(new Request("http://localhost/api/admin/tenants?page=2&pageSize=50&keyword=Studio&status=disabled"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ code: 0, data: { items: [], total: 0, page: 1, pageSize: 20 }, msg: "" });
        expect(mocks.requirePlatformPermission).toHaveBeenCalledWith(expect.any(Request), "platform.tenants.read");
        expect(mocks.list).toHaveBeenCalledWith({ page: 2, pageSize: 50, keyword: "Studio", status: "disabled" });
    });

    it("creates a tenant through the platform manage permission", async () => {
        const response = await POST(
            new Request("http://localhost/api/admin/tenants", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ slug: "tenant-a", name: "Tenant A" }),
            }),
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({ code: 0, data: { tenant: { id: "tenant-a" } } });
        expect(mocks.createWithOwner).toHaveBeenCalledWith({
            slug: "tenant-a",
            name: "Tenant A",
            ownerUserId: "admin-one",
        });
        expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.tenant.create", target: expect.objectContaining({ id: "tenant-a" }) }));
    });

    it("rejects invalid tenant input before repository writes", async () => {
        const response = await POST(
            new Request("http://localhost/api/admin/tenants", {
                method: "POST",
                body: JSON.stringify({ slug: "-invalid", name: "" }),
            }),
        );

        expect(response.status).toBe(400);
        expect(mocks.createWithOwner).not.toHaveBeenCalled();
    });
});
