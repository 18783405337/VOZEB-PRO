import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireTenantMembership: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: class AuthorizationError extends Error {},
    requireTenantMembership: mocks.requireTenantMembership,
}));

import { GET } from "./route";

describe("tenant context API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireTenantMembership.mockResolvedValue({
            user: { id: "user-one" },
            tenant: { id: "tenant-a", slug: "tenant-a", name: "Tenant A", status: "active" },
            member: { userId: "user-one", roleKey: "member", status: "active", permissions: [] },
            source: "domain",
        });
    });

    it("returns the resolved tenant and current membership", async () => {
        const request = new Request("https://tenant.example.com/api/tenant/context");
        const response = await GET(request);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            code: 0,
            data: {
                tenant: { id: "tenant-a" },
                member: { userId: "user-one", roleKey: "member" },
                source: "domain",
            },
        });
        expect(mocks.requireTenantMembership).toHaveBeenCalledWith(request);
    });
});
