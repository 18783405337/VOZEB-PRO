import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    addMember: vi.fn(),
    audit: vi.fn(),
    auditActorFromRequest: vi.fn(() => ({ id: "owner-one" })),
    getMember: vi.fn(),
    getRole: vi.fn(),
    listMembers: vi.fn(),
    requireTenantPermission: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: class AuthorizationError extends Error {},
    requireTenantPermission: mocks.requireTenantPermission,
}));

vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: () => ({
        tenants: {
            addMember: mocks.addMember,
            getMember: mocks.getMember,
            getRole: mocks.getRole,
            listMembers: mocks.listMembers,
        },
    }),
}));

vi.mock("@/lib/server/audit-log-store", () => ({
    auditActorFromRequest: mocks.auditActorFromRequest,
    safeRecordAuditLog: mocks.audit,
}));

import { GET, POST } from "./route";

describe("tenant members API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireTenantPermission.mockResolvedValue({ tenant: { id: "tenant-a" }, user: { id: "owner-one", role: "user" } });
        mocks.listMembers.mockResolvedValue([]);
        mocks.getMember.mockResolvedValue(null);
        mocks.getRole.mockResolvedValue({ id: "role-member", tenantId: "tenant-a", key: "member" });
        mocks.addMember.mockResolvedValue({ tenantId: "tenant-a", userId: "user-two", roleId: "role-member", status: "active" });
    });

    it("lists only members from the resolved tenant", async () => {
        const request = new Request("https://a.example.com/api/tenant/members");
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(request, "tenant.members.read");
        expect(mocks.listMembers).toHaveBeenCalledWith("tenant-a");
    });

    it("passes only the resolved tenant id to member creation", async () => {
        const response = await POST(
            new Request("https://a.example.com/api/tenant/members", {
                method: "POST",
                body: JSON.stringify({ tenantId: "tenant-b", userId: "user-two", roleId: "role-member" }),
            }),
        );

        expect(response.status).toBe(201);
        expect(mocks.addMember).toHaveBeenCalledWith({
            tenantId: "tenant-a",
            userId: "user-two",
            roleId: "role-member",
            status: "active",
        });
        expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "tenant.member.add", metadata: expect.objectContaining({ tenantId: "tenant-a" }) }));
    });

    it("rejects a role that does not belong to the resolved tenant", async () => {
        mocks.getRole.mockResolvedValue(null);

        const response = await POST(
            new Request("https://a.example.com/api/tenant/members", {
                method: "POST",
                body: JSON.stringify({ userId: "user-two", roleId: "tenant-b-role" }),
            }),
        );

        expect(response.status).toBe(404);
        expect(mocks.addMember).not.toHaveBeenCalled();
    });

    it("rejects assigning or modifying the tenant owner role", async () => {
        mocks.getRole.mockResolvedValueOnce({ id: "role-owner", tenantId: "tenant-a", key: "owner" });
        const assignmentResponse = await POST(
            new Request("https://a.example.com/api/tenant/members", {
                method: "POST",
                body: JSON.stringify({ userId: "user-two", roleId: "role-owner" }),
            }),
        );

        mocks.getRole.mockResolvedValueOnce({ id: "role-member", tenantId: "tenant-a", key: "member" });
        mocks.getMember.mockResolvedValueOnce({ tenantId: "tenant-a", userId: "owner-one", roleId: "role-owner", roleKey: "owner", status: "active" });
        const mutationResponse = await POST(
            new Request("https://a.example.com/api/tenant/members", {
                method: "POST",
                body: JSON.stringify({ userId: "owner-one", roleId: "role-member" }),
            }),
        );

        expect(assignmentResponse.status).toBe(403);
        expect(mutationResponse.status).toBe(403);
        expect(mocks.addMember).not.toHaveBeenCalled();
        expect(mocks.audit).toHaveBeenCalledTimes(2);
        expect(mocks.audit).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                action: "tenant.member.add",
                status: "failure",
                metadata: expect.objectContaining({ reason: "owner_role_assignment_forbidden" }),
            }),
        );
        expect(mocks.audit).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                action: "tenant.member.role.update",
                status: "failure",
                metadata: expect.objectContaining({
                    previousRoleId: "role-owner",
                    reason: "owner_membership_change_forbidden",
                }),
            }),
        );
    });

    it("records role updates with the previous role", async () => {
        mocks.getMember.mockResolvedValue({ tenantId: "tenant-a", userId: "user-two", roleId: "role-viewer", roleKey: "viewer", status: "active" });

        const response = await POST(
            new Request("https://a.example.com/api/tenant/members", {
                method: "POST",
                body: JSON.stringify({ userId: "user-two", roleId: "role-member" }),
            }),
        );

        expect(response.status).toBe(201);
        expect(mocks.audit).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "tenant.member.role.update",
                metadata: expect.objectContaining({ previousRoleId: "role-viewer", roleId: "role-member", tenantId: "tenant-a" }),
            }),
        );
    });

    it("records failed member writes", async () => {
        mocks.addMember.mockRejectedValue(new Error("database unavailable"));

        const response = await POST(
            new Request("https://a.example.com/api/tenant/members", {
                method: "POST",
                body: JSON.stringify({ userId: "user-two", roleId: "role-member" }),
            }),
        );

        expect(response.status).toBe(500);
        expect(mocks.audit).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "tenant.member.add",
                status: "failure",
                metadata: expect.objectContaining({ tenantId: "tenant-a", error: "database unavailable" }),
            }),
        );
    });

    it("records the previous role when a role update fails", async () => {
        mocks.getMember.mockResolvedValue({ tenantId: "tenant-a", userId: "user-two", roleId: "role-viewer", roleKey: "viewer", status: "active" });
        mocks.addMember.mockRejectedValue(new Error("database unavailable"));

        const response = await POST(
            new Request("https://a.example.com/api/tenant/members", {
                method: "POST",
                body: JSON.stringify({ userId: "user-two", roleId: "role-member" }),
            }),
        );

        expect(response.status).toBe(500);
        expect(mocks.audit).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "tenant.member.role.update",
                status: "failure",
                metadata: expect.objectContaining({
                    previousRoleId: "role-viewer",
                    roleId: "role-member",
                    tenantId: "tenant-a",
                }),
            }),
        );
    });
});
