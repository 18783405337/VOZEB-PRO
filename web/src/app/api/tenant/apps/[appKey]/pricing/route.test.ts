import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getTenantApp: vi.fn(),
    requireTenantPermission: vi.fn(),
    savePricing: vi.fn(),
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
            savePricing: mocks.savePricing,
        },
    }),
}));

import { PUT } from "./route";

describe("tenant application pricing API", () => {
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
            settings: {},
            pricing: null,
            definition: { key: "background-removal", version: "1.0.0", inputSchema: [] },
        });
        mocks.savePricing.mockResolvedValue(undefined);
    });

    it("stores pricing through tenant configure permission", async () => {
        const response = await PUT(
            new Request("https://tenant.example.com/api/tenant/apps/background-removal/pricing", {
                method: "PUT",
                body: JSON.stringify({ currency: "POINT", saleUnit: "task", saleAmount: 10, collectionMode: "platform" }),
            }),
            { params: Promise.resolve({ appKey: "background-removal" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Request), "tenant.apps.configure");
        expect(mocks.savePricing).toHaveBeenCalledWith("tenant-a", "tenant-app-a", expect.objectContaining({ saleAmount: 10 }));
    });
});
