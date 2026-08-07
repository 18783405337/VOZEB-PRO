import { afterEach, describe, expect, it, vi } from "vitest";

import { addTenantMember, createTenantRole, getTenantAdminContext, listTenantMembers, listTenantRoles } from "./tenant-admin";

describe("tenant admin API client", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("loads the trusted tenant context, members, and roles", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(Response.json({ code: 0, data: { tenant: { id: "tenant-a" } }, msg: "" }))
            .mockResolvedValueOnce(Response.json({ code: 0, data: { members: [] }, msg: "" }))
            .mockResolvedValueOnce(Response.json({ code: 0, data: { roles: [] }, msg: "" }));
        vi.stubGlobal("fetch", fetchMock);

        await getTenantAdminContext();
        await listTenantMembers();
        await listTenantRoles();

        expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(["/api/tenant/context", "/api/tenant/members", "/api/tenant/roles"]);
    });

    it("posts member and role changes through the tenant APIs", async () => {
        const fetchMock = vi.fn().mockImplementation(() => Response.json({ code: 0, data: { ok: true }, msg: "" }));
        vi.stubGlobal("fetch", fetchMock);

        await addTenantMember({ userId: "user-two", roleId: "role-editor" });
        await createTenantRole({ key: "editor", name: "编辑", permissions: ["tenant.apps.read"] });

        expect(fetchMock.mock.calls[0][0]).toBe("/api/tenant/members");
        expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
        expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ userId: "user-two", roleId: "role-editor" }));
        expect(fetchMock.mock.calls[1][0]).toBe("/api/tenant/roles");
    });
});
