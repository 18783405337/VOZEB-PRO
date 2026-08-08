import { describe, expect, it, vi } from "vitest";

import { appRegistry } from "@/lib/apps/app-registry";
import type { AppCenterRepository, PublishedAppVersion, TenantAppDetails } from "@/lib/server/database/app-center-repository";

import { AppCenterService } from "./app-center-service";

function createRepository(overrides: Partial<AppCenterRepository> = {}): AppCenterRepository {
    return {
        publish: vi.fn(),
        listPublished: vi.fn(),
        getPublished: vi.fn(),
        install: vi.fn(),
        setStatus: vi.fn(),
        saveSettings: vi.fn(),
        savePricing: vi.fn(),
        getProviderBinding: vi.fn(),
        saveProviderBinding: vi.fn(),
        clearProviderBinding: vi.fn(),
        getTenantApp: vi.fn(),
        listTenantApps: vi.fn(),
        ...overrides,
    };
}

function publishedVersion(definition = appRegistry.get("background-removal", "1.0.0")!) {
    return {
        id: "version-a",
        appId: "app-a",
        appKey: definition.key,
        version: definition.version,
        definition,
        publishedAt: 1,
    } satisfies PublishedAppVersion;
}

function tenantApp(): TenantAppDetails {
    const definition = appRegistry.get("background-removal", "1.0.0")!;
    return {
        id: "tenant-app-a",
        tenantId: "tenant-a",
        appId: "app-a",
        appKey: definition.key,
        version: definition.version,
        status: "enabled",
        installedBy: "user-a",
        installedAt: 1,
        updatedAt: 1,
        definition,
        settings: {},
        secretRefs: {},
        pricing: null,
    };
}

describe("AppCenterService", () => {
    it("requires installation without forcing an enabled runtime state", async () => {
        const installed = { ...tenantApp(), status: "disabled" as const };
        const repository = createRepository({ getTenantApp: vi.fn().mockResolvedValue(installed) });
        const service = new AppCenterService(repository, appRegistry);

        await expect(service.requireTenantApp("tenant-a", "background-removal")).resolves.toEqual(installed);

        repository.getTenantApp = vi.fn().mockResolvedValue(null);
        await expect(service.requireTenantApp("tenant-a", "background-removal")).rejects.toMatchObject({
            code: "APP_NOT_INSTALLED",
        });
    });

    it("requires an installed and enabled application for runtime execution", async () => {
        const installed = tenantApp();
        const repository = createRepository({ getTenantApp: vi.fn().mockResolvedValue(installed) });
        const service = new AppCenterService(repository, appRegistry);

        await expect(service.requireEnabledTenantApp("tenant-a", "background-removal", "background-removal.v1")).resolves.toEqual(installed);

        await expect(service.requireEnabledTenantApp("tenant-a", "background-removal", "product-image.v1")).rejects.toMatchObject({
            code: "APP_WORKFLOW_MISMATCH",
        });
    });

    it("rejects runtime execution for missing or disabled applications", async () => {
        const repository = createRepository({ getTenantApp: vi.fn().mockResolvedValue(null) });
        const service = new AppCenterService(repository, appRegistry);

        await expect(service.requireEnabledTenantApp("tenant-a", "background-removal", "background-removal.v1")).rejects.toMatchObject({
            code: "APP_NOT_INSTALLED",
        });

        repository.getTenantApp = vi.fn().mockResolvedValue({ ...tenantApp(), status: "disabled" });
        await expect(service.requireEnabledTenantApp("tenant-a", "background-removal", "background-removal.v1")).rejects.toMatchObject({
            code: "APP_DISABLED",
        });
    });

    it("rejects publication when the stored definition differs from the reviewed registry", async () => {
        const definition = appRegistry.get("background-removal", "1.0.0")!;
        const repository = createRepository({
            getPublished: vi.fn().mockResolvedValue(publishedVersion({ ...definition, name: "Unreviewed name" })),
        });
        const service = new AppCenterService(repository, appRegistry);

        await expect(service.publishAppVersion({ appKey: definition.key, version: definition.version })).rejects.toThrow("Published application definition differs from reviewed registry");
    });

    it("rejects tenant installation of an unpublished application version", async () => {
        const repository = createRepository({ getPublished: vi.fn().mockResolvedValue(null) });
        const service = new AppCenterService(repository, appRegistry);

        await expect(service.installTenantApp("tenant-a", { appKey: "background-removal", version: "1.0.0", installedBy: "user-a" })).rejects.toThrow(
            "Application version is not published",
        );
    });

    it("rejects configuration settings outside the reviewed schema or with invalid primitive types", async () => {
        const repository = createRepository({ getTenantApp: vi.fn().mockResolvedValue(tenantApp()) });
        const service = new AppCenterService(repository, appRegistry);

        await expect(
            service.saveTenantAppSettings("tenant-a", "background-removal", {
                settings: { unsupported: "value" },
                secretRefs: {},
                updatedBy: "user-a",
            }),
        ).rejects.toThrow("Unsupported application setting: unsupported");

        await expect(
            service.saveTenantAppSettings("tenant-a", "background-removal", {
                settings: { quality: 2 },
                secretRefs: {},
                updatedBy: "user-a",
            }),
        ).rejects.toThrow("Invalid value for application setting: quality");
    });
});
