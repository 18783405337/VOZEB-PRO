import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getTenantApp: vi.fn(),
    requireTenantPermission: vi.fn(),
    saveSettings: vi.fn(),
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
            saveSettings: mocks.saveSettings,
        },
    }),
}));

import { PUT } from "./route";

describe("tenant application settings API", () => {
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
            definition: {
                key: "background-removal",
                version: "1.0.0",
                inputSchema: [{ key: "quality", kind: "select", label: "Quality", required: true, options: ["standard", "high"] }],
            },
        });
        mocks.saveSettings.mockResolvedValue(undefined);
    });

    it("rejects unsupported settings before the repository write", async () => {
        const response = await PUT(
            new Request("https://tenant.example.com/api/tenant/apps/background-removal/settings", {
                method: "PUT",
                body: JSON.stringify({ settings: { executable: "blocked" }, secretRefs: {} }),
            }),
            { params: Promise.resolve({ appKey: "background-removal" }) },
        );

        expect(response.status).toBe(400);
        expect(mocks.saveSettings).not.toHaveBeenCalled();
    });

    it("stores settings for the resolved tenant and never returns secret references", async () => {
        const response = await PUT(
            new Request("https://tenant.example.com/api/tenant/apps/background-removal/settings", {
                method: "PUT",
                body: JSON.stringify({ tenantId: "tenant-b", settings: { quality: "high" }, secretRefs: { provider: "secret-one" } }),
            }),
            { params: Promise.resolve({ appKey: "background-removal" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.saveSettings).toHaveBeenCalledWith("tenant-a", "tenant-app-a", expect.objectContaining({ settings: { quality: "high" } }));
        const body = await response.json();
        expect(body).toMatchObject({ code: 0, data: { saved: true } });
        expect(body.data.secretRefs).toBeUndefined();
    });
});
