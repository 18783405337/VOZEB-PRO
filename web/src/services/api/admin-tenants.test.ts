import { afterEach, describe, expect, it, vi } from "vitest";

import { createPlatformTenant, listPlatformTenants, updatePlatformTenant } from "./admin-tenants";

describe("platform tenant API client", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("encodes filters when listing tenants", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { items: [], total: 0 }, msg: "" }));
        vi.stubGlobal("fetch", fetchMock);

        await listPlatformTenants({ keyword: "团队 A", status: "active", page: 2, pageSize: 10 });

        expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/tenants?keyword=%E5%9B%A2%E9%98%9F+A&status=active&page=2&pageSize=10");
    });

    it("creates and updates tenants through platform endpoints", async () => {
        const fetchMock = vi.fn().mockImplementation(() => Response.json({ code: 0, data: { tenant: { id: "tenant-a" } }, msg: "" }));
        vi.stubGlobal("fetch", fetchMock);

        await createPlatformTenant({ slug: "team-a", name: "Team A" });
        await updatePlatformTenant("tenant-a", { status: "disabled" });

        expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/tenants");
        expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("PATCH");
        expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/tenants/tenant-a");
    });
});
