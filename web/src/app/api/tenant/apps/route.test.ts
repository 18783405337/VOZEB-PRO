import { beforeEach, describe, expect, it, vi } from "vitest";

import { appRegistry } from "@/lib/apps/app-registry";

const mocks = vi.hoisted(() => ({
    AuthorizationError: class AuthorizationError extends Error {
        constructor(
            message: string,
            readonly status: number,
            readonly code: string,
        ) {
            super(message);
        }
    },
    getPublished: vi.fn(),
    install: vi.fn(),
    listPublished: vi.fn(),
    listTenantApps: vi.fn(),
    requireTenantPermission: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: mocks.AuthorizationError,
    requireTenantPermission: mocks.requireTenantPermission,
}));

vi.mock("@/lib/server/database", () => ({
    isPostgresDatabaseEnabled: () => true,
    createPostgresRepositories: () => ({
        appCenter: {
            getPublished: mocks.getPublished,
            install: mocks.install,
            listPublished: mocks.listPublished,
            listTenantApps: mocks.listTenantApps,
        },
    }),
}));

import { GET, POST } from "./route";

describe("tenant application collection API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_APP_CENTER_ENABLED = "1";
        mocks.requireTenantPermission.mockResolvedValue({ tenant: { id: "tenant-a" }, user: { id: "user-a" } });
        mocks.listPublished.mockResolvedValue([]);
        mocks.listTenantApps.mockResolvedValue([]);
        mocks.getPublished.mockResolvedValue({
            id: "version-a",
            appId: "app-a",
            appKey: "background-removal",
            version: "1.0.0",
            definition: appRegistry.get("background-removal", "1.0.0"),
            publishedAt: 1,
        });
        mocks.install.mockResolvedValue({ id: "tenant-app-a", tenantId: "tenant-a", appKey: "background-removal", version: "1.0.0", status: "enabled" });
    });

    it("lists published and tenant-installed applications inside the resolved tenant", async () => {
        const response = await GET(new Request("https://tenant.example.com/api/tenant/apps"));

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Request), "tenant.apps.read");
        expect(mocks.listTenantApps).toHaveBeenCalledWith("tenant-a");
        expect(mocks.listPublished).toHaveBeenCalledTimes(1);
    });

    it("installs only the requested published version for the resolved tenant", async () => {
        const response = await POST(
            new Request("https://tenant.example.com/api/tenant/apps", {
                method: "POST",
                body: JSON.stringify({ tenantId: "tenant-b", appKey: "background-removal", version: "1.0.0" }),
            }),
        );

        expect(response.status).toBe(201);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Request), "tenant.apps.configure");
        expect(mocks.install).toHaveBeenCalledWith("tenant-a", {
            appKey: "background-removal",
            version: "1.0.0",
            installedBy: "user-a",
        });
    });

    it("returns 403 when the tenant permission check rejects the request", async () => {
        mocks.requireTenantPermission.mockRejectedValue(new mocks.AuthorizationError("forbidden", 403, "tenant.permission_denied"));

        const response = await GET(new Request("https://tenant.example.com/api/tenant/apps"));

        expect(response.status).toBe(403);
    });

    it("returns 409 when the requested application version is not published", async () => {
        mocks.getPublished.mockResolvedValue(null);

        const response = await POST(
            new Request("https://tenant.example.com/api/tenant/apps", {
                method: "POST",
                body: JSON.stringify({ appKey: "background-removal", version: "1.0.0" }),
            }),
        );

        expect(response.status).toBe(409);
    });
});
