import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getTenantApp: vi.fn(),
    requireTenantPermission: vi.fn(),
    setStatus: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: class AuthorizationError extends Error {},
    requireTenantPermission: mocks.requireTenantPermission,
}));

vi.mock("@/lib/server/database", () => ({
    isPostgresDatabaseEnabled: () => true,
    createPostgresRepositories: () => ({
        appCenter: {
            getTenantApp: mocks.getTenantApp,
            setStatus: mocks.setStatus,
        },
    }),
}));

import { GET, PATCH } from "./route";

describe("tenant application detail API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_APP_CENTER_ENABLED = "1";
        mocks.requireTenantPermission.mockResolvedValue({ tenant: { id: "tenant-a" }, user: { id: "user-a" } });
        mocks.getTenantApp.mockResolvedValue({
            id: "tenant-app-a",
            tenantId: "tenant-a",
            appKey: "background-removal",
            version: "1.0.0",
            status: "enabled",
            settings: { quality: "high" },
            pricing: null,
            definition: { key: "background-removal", version: "1.0.0" },
        });
        mocks.setStatus.mockResolvedValue({
            id: "tenant-app-a",
            tenantId: "tenant-a",
            appKey: "background-removal",
            version: "1.0.0",
            status: "disabled",
        });
    });

    it("returns 404 when the application is not installed for this tenant", async () => {
        mocks.getTenantApp.mockResolvedValue(null);

        const response = await GET(new Request("https://tenant.example.com/api/tenant/apps/background-removal"), {
            params: Promise.resolve({ appKey: "background-removal" }),
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toMatchObject({ code: 404, data: null });
    });

    it("updates status using the resolved tenant installation", async () => {
        const response = await PATCH(
            new Request("https://tenant.example.com/api/tenant/apps/background-removal", {
                method: "PATCH",
                body: JSON.stringify({ tenantId: "tenant-b", status: "disabled" }),
            }),
            { params: Promise.resolve({ appKey: "background-removal" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Request), "tenant.apps.configure");
        expect(mocks.setStatus).toHaveBeenCalledWith("tenant-a", "tenant-app-a", "disabled");
    });
});
