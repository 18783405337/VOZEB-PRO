import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getTenantContext: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
    getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/server/tenant/tenant-context", () => ({
    getTenantContext: mocks.getTenantContext,
}));

import { requirePlatformPermission, requireTenantPermission } from "./authorization-service";

function request() {
    return new Request("https://tenant.example.com/api/apps");
}

describe("authorization guards", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("requires authentication for platform permissions", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);

        await expect(requirePlatformPermission(request(), "platform.tenants.read")).rejects.toMatchObject({
            code: "auth.required",
            status: 401,
        });
    });

    it("rejects a global user from platform permissions", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one", role: "user" });

        await expect(requirePlatformPermission(request(), "platform.tenants.read")).rejects.toMatchObject({
            code: "platform.permission_denied",
            status: 403,
        });
    });

    it("accepts a global administrator for platform permissions", async () => {
        const user = { id: "admin-one", role: "admin" };
        mocks.getCurrentUser.mockResolvedValue(user);

        await expect(requirePlatformPermission(request(), "platform.tenants.manage")).resolves.toEqual({
            permission: "platform.tenants.manage",
            user,
        });
    });

    it("requires authentication before resolving tenant permissions", async () => {
        mocks.getCurrentUser.mockResolvedValue(null);

        await expect(requireTenantPermission(request(), "tenant.members.read")).rejects.toMatchObject({
            code: "auth.required",
            status: 401,
        });
        expect(mocks.getTenantContext).not.toHaveBeenCalled();
    });

    it("accepts an active tenant member with the requested permission", async () => {
        const user = { id: "user-one", role: "user" };
        const context = {
            tenant: { id: "tenant-a", status: "active" },
            source: "domain",
            member: { roleKey: "member", status: "active", permissions: ["tenant.members.manage"] },
        };
        mocks.getCurrentUser.mockResolvedValue(user);
        mocks.getTenantContext.mockResolvedValue(context);

        await expect(requireTenantPermission(request(), "tenant.members.manage")).resolves.toEqual({
            ...context,
            permission: "tenant.members.manage",
            user,
        });
        expect(mocks.getTenantContext).toHaveBeenCalledWith(expect.any(Request), { user, requireMembership: true });
    });

    it("allows tenant owners to use any tenant permission", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "owner-one", role: "user" });
        mocks.getTenantContext.mockResolvedValue({
            tenant: { id: "tenant-a", status: "active" },
            source: "domain",
            member: { roleKey: "owner", status: "active", permissions: [] },
        });

        await expect(requireTenantPermission(request(), "tenant.apps.use.virtual-try-on")).resolves.toMatchObject({
            permission: "tenant.apps.use.virtual-try-on",
        });
    });

    it("rejects a tenant member without the requested permission", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one", role: "user" });
        mocks.getTenantContext.mockResolvedValue({
            tenant: { id: "tenant-a", status: "active" },
            source: "domain",
            member: { roleKey: "member", status: "active", permissions: ["tenant.apps.read"] },
        });

        await expect(requireTenantPermission(request(), "tenant.apps.configure")).rejects.toMatchObject({
            code: "tenant.permission_denied",
            status: 403,
        });
    });
});
