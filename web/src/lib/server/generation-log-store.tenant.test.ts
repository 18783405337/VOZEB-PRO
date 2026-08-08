import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    ensureSchema: vi.fn(),
    getRegistration: vi.fn(),
    isPostgres: vi.fn(),
    listByUserAndAssetUrls: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: () => ({
        generationLogs: {
            listByUserAndAssetUrls: mocks.listByUserAndAssetUrls,
        },
    }),
    ensurePostgresSchema: mocks.ensureSchema,
    isPostgresDatabaseEnabled: mocks.isPostgres,
    withPostgresTransaction: vi.fn(),
}));

vi.mock("@/lib/server/local-media-registry", () => ({
    getLocalMediaRegistration: mocks.getRegistration,
}));

import { canAccessGenerationAsset } from "./generation-log-store";

const originalSaasEnabled = process.env.VOZEB_PRO_SAAS_ENABLED;

describe("generation asset tenant isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_SAAS_ENABLED = "1";
        mocks.isPostgres.mockReturnValue(true);
        mocks.getRegistration.mockResolvedValue({ ownerUserId: "user-one" });
        mocks.listByUserAndAssetUrls.mockResolvedValue([]);
    });

    it("requires an asset reference inside the active tenant even when the local owner matches", async () => {
        await expect(canAccessGenerationAsset("user-one", "user", "/api/generation-log-assets/permanent/asset.png", "tenant-two")).resolves.toBe(false);

        expect(mocks.listByUserAndAssetUrls).toHaveBeenCalledWith(
            "user-one",
            ["/api/generation-log-assets/permanent/asset.png"],
            "tenant-two",
        );
    });

    it("allows an owned asset referenced by a generation log in the active tenant", async () => {
        mocks.listByUserAndAssetUrls.mockResolvedValue([{ id: "log-one", tenantId: "tenant-one" }]);

        await expect(canAccessGenerationAsset("user-one", "user", "/api/generation-log-assets/permanent/asset.png", "tenant-one")).resolves.toBe(true);
    });

    it("preserves owner access to registered assets while SaaS is disabled", async () => {
        process.env.VOZEB_PRO_SAAS_ENABLED = "0";

        await expect(canAccessGenerationAsset("user-one", "user", "/api/generation-log-assets/permanent/legacy.png", "default")).resolves.toBe(true);
        expect(mocks.listByUserAndAssetUrls).not.toHaveBeenCalled();
    });
});

afterEach(() => {
    if (originalSaasEnabled === undefined) delete process.env.VOZEB_PRO_SAAS_ENABLED;
    else process.env.VOZEB_PRO_SAAS_ENABLED = originalSaasEnabled;
});
