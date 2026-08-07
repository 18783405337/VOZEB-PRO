import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    audit: vi.fn(),
    auditActorFromRequest: vi.fn(() => ({ id: "owner-one" })),
    createRole: vi.fn(),
    listRoles: vi.fn(),
    requireTenantPermission: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: class AuthorizationError extends Error {},
    requireTenantPermission: mocks.requireTenantPermission,
}));

vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: () => ({
        tenants: {
            createRole: mocks.createRole,
            listRoles: mocks.listRoles,
        },
    }),
}));

vi.mock("@/lib/server/audit-log-store", () => ({
    auditActorFromRequest: mocks.auditActorFromRequest,
    safeRecordAuditLog: mocks.audit,
}));

import { GET, POST } from "./route";

describe("tenant roles API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireTenantPermission.mockResolvedValue({ tenant: { id: "tenant-a" }, user: { id: "owner-one", role: "user" } });
        mocks.listRoles.mockResolvedValue([]);
        mocks.createRole.mockResolvedValue({ id: "role-editor", tenantId: "tenant-a", key: "editor", name: "Editor", system: false, permissions: ["tenant.apps.read"] });
    });

    it("lists roles only from the resolved tenant", async () => {
        const request = new Request("https://a.example.com/api/tenant/roles");
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(request, "tenant.roles.manage");
        expect(mocks.listRoles).toHaveBeenCalledWith("tenant-a");
    });

    it("creates a role inside the resolved tenant", async () => {
        const response = await POST(
            new Request("https://a.example.com/api/tenant/roles", {
                method: "POST",
                body: JSON.stringify({ tenantId: "tenant-b", key: "editor", name: "Editor", permissions: ["tenant.apps.read"] }),
            }),
        );

        expect(response.status).toBe(201);
        expect(mocks.createRole).toHaveBeenCalledWith({
            tenantId: "tenant-a",
            key: "editor",
            name: "Editor",
            permissions: ["tenant.apps.read"],
        });
        expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "tenant.role.create", metadata: expect.objectContaining({ tenantId: "tenant-a" }) }));
    });

    it("allows a new tenant to create its standard member role", async () => {
        mocks.createRole.mockResolvedValue({ id: "role-member", tenantId: "tenant-a", key: "member", name: "Member", system: false, permissions: ["tenant.apps.read"] });

        const response = await POST(
            new Request("https://a.example.com/api/tenant/roles", {
                method: "POST",
                body: JSON.stringify({ key: "member", name: "Member", permissions: ["tenant.apps.read"] }),
            }),
        );

        expect(response.status).toBe(201);
        expect(mocks.createRole).toHaveBeenCalledWith({
            tenantId: "tenant-a",
            key: "member",
            name: "Member",
            permissions: ["tenant.apps.read"],
        });
    });

    it("rejects platform and unknown permissions", async () => {
        const platformResponse = await POST(
            new Request("https://a.example.com/api/tenant/roles", {
                method: "POST",
                body: JSON.stringify({ key: "admin", name: "Admin", permissions: ["platform.tenants.manage"] }),
            }),
        );
        const unknownResponse = await POST(
            new Request("https://a.example.com/api/tenant/roles", {
                method: "POST",
                body: JSON.stringify({ key: "custom", name: "Custom", permissions: ["tenant.unknown"] }),
            }),
        );

        expect(platformResponse.status).toBe(400);
        expect(unknownResponse.status).toBe(400);
        expect(mocks.createRole).not.toHaveBeenCalled();
    });
});
