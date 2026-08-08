import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    class SpecializedProviderBindingError extends Error {
        constructor(
            message: string,
            readonly code: string,
        ) {
            super(message);
        }
    }

    return {
        SpecializedProviderBindingError,
        clearBinding: vi.fn(),
        getBinding: vi.fn(),
        listLogicalApis: vi.fn(),
        requireTenantPermission: vi.fn(),
        saveBinding: vi.fn(),
    };
});

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: class AuthorizationError extends Error {},
    requireTenantPermission: mocks.requireTenantPermission,
}));

vi.mock("@/lib/server/database", () => ({
    isPostgresDatabaseEnabled: () => true,
    createPostgresRepositories: () => ({ appCenter: {} }),
}));

vi.mock("@/lib/server/apps/specialized-provider-binding-service", () => ({
    SpecializedProviderBindingError: mocks.SpecializedProviderBindingError,
    SpecializedProviderBindingService: class SpecializedProviderBindingService {
        clearTenantAppProviderBinding = mocks.clearBinding;
        getTenantAppProviderBinding = mocks.getBinding;
        listTenantAppLogicalApis = mocks.listLogicalApis;
        saveTenantAppProviderBinding = mocks.saveBinding;
    },
}));

import { DELETE, GET, PUT } from "./route";

const context = { params: Promise.resolve({ appKey: "aigc-digital-human" }) };

describe("tenant application provider binding API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_APP_CENTER_ENABLED = "1";
        mocks.requireTenantPermission.mockResolvedValue({ tenant: { id: "tenant-a" }, user: { id: "user-a" } });
        mocks.getBinding.mockResolvedValue({ logicalModelKey: "avatar-pro", name: "Avatar Pro", status: "enabled" });
        mocks.listLogicalApis.mockResolvedValue([{ logicalModelKey: "avatar-pro", name: "Avatar Pro" }]);
        mocks.saveBinding.mockResolvedValue({ logicalModelKey: "avatar-pro", name: "Avatar Pro", status: "enabled" });
        mocks.clearBinding.mockResolvedValue(undefined);
    });

    it("requires read permission and returns logical API details only", async () => {
        const response = await GET(new Request("https://tenant.example.com/api/tenant/apps/aigc-digital-human/provider-binding"), context);

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Request), "tenant.apps.read");
        expect(mocks.getBinding).toHaveBeenCalledWith("tenant-a", "aigc-digital-human");
        expect(mocks.listLogicalApis).toHaveBeenCalledWith("tenant-a", "aigc-digital-human");

        const body = await response.json();
        expect(body.data).toEqual({
            binding: { logicalModelKey: "avatar-pro", name: "Avatar Pro", status: "enabled" },
            available: [{ logicalModelKey: "avatar-pro", name: "Avatar Pro" }],
        });
        expect(JSON.stringify(body)).not.toMatch(/baseUrl|apiKey|channelId|upstreamModel/);
    });

    it("requires configure permission and stores only the selected logical API", async () => {
        const response = await PUT(
            new Request("https://tenant.example.com/api/tenant/apps/aigc-digital-human/provider-binding", {
                method: "PUT",
                body: JSON.stringify({ logicalModelKey: "avatar-pro" }),
            }),
            context,
        );

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Request), "tenant.apps.configure");
        expect(mocks.saveBinding).toHaveBeenCalledWith("tenant-a", "aigc-digital-human", "avatar-pro", "user-a");
    });

    it("rejects provider channel configuration fields from tenant requests", async () => {
        const response = await PUT(
            new Request("https://tenant.example.com/api/tenant/apps/aigc-digital-human/provider-binding", {
                method: "PUT",
                body: JSON.stringify({
                    logicalModelKey: "avatar-pro",
                    baseUrl: "https://forged.example.com",
                    apiKey: "forged-key",
                    channelId: "forged-channel",
                }),
            }),
            context,
        );

        expect(response.status).toBe(400);
        expect(mocks.saveBinding).not.toHaveBeenCalled();
    });

    it("requires configure permission before clearing the binding", async () => {
        const response = await DELETE(new Request("https://tenant.example.com/api/tenant/apps/aigc-digital-human/provider-binding", { method: "DELETE" }), context);

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Request), "tenant.apps.configure");
        expect(mocks.clearBinding).toHaveBeenCalledWith("tenant-a", "aigc-digital-human");
        const body = await response.json();
        expect(body.data.binding).toBeNull();
    });

    it("maps provider binding errors to stable HTTP statuses", async () => {
        mocks.getBinding.mockRejectedValue(new mocks.SpecializedProviderBindingError("Logical API is disabled", "LOGICAL_API_DISABLED"));

        const response = await GET(new Request("https://tenant.example.com/api/tenant/apps/aigc-digital-human/provider-binding"), context);

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ code: 409, msg: "Logical API is disabled" });
    });
});
