import { describe, expect, it, vi } from "vitest";

import type { AuthSettings } from "@/lib/auth/store";
import type { AppDefinition } from "@/lib/apps/app-definition";
import type { AppCenterRepository, TenantAppDetails, TenantAppProviderBinding } from "@/lib/server/database/app-center-repository";

import { SpecializedProviderBindingService } from "./specialized-provider-binding-service";

function createRepository(overrides: Partial<AppCenterRepository> = {}): AppCenterRepository {
    return {
        publish: vi.fn(),
        listPublished: vi.fn(),
        getPublished: vi.fn(),
        install: vi.fn(),
        setStatus: vi.fn(),
        saveSettings: vi.fn(),
        savePricing: vi.fn(),
        getProviderBinding: vi.fn().mockResolvedValue(null),
        saveProviderBinding: vi.fn(),
        clearProviderBinding: vi.fn(),
        getTenantApp: vi.fn().mockResolvedValue(tenantApp()),
        listTenantApps: vi.fn(),
        ...overrides,
    };
}

function tenantApp(status: "enabled" | "disabled" = "enabled"): TenantAppDetails {
    return {
        id: "tenant-app-a",
        tenantId: "tenant-a",
        appId: "app-a",
        appKey: "aigc-digital-human",
        version: "1.0.0",
        status,
        installedBy: "user-a",
        installedAt: 1,
        updatedAt: 1,
        definition: { key: "aigc-digital-human", version: "1.0.0" } as AppDefinition,
        settings: {},
        secretRefs: {},
        pricing: null,
    };
}

function providerBinding(logicalModelKey = "avatar-pro"): TenantAppProviderBinding {
    return {
        id: "binding-a",
        tenantAppId: "tenant-app-a",
        logicalModelKey,
        status: "enabled",
        boundBy: "user-a",
        createdAt: 1,
        updatedAt: 2,
    };
}

function routingSettings() {
    return {
        logicalModels: [
            {
                id: "avatar-pro",
                name: "Avatar Pro",
                capability: "video" as const,
                enabled: true,
                appKeys: ["aigc-digital-human" as const],
                bindings: [
                    { id: "backup-binding", channelId: "backup", upstreamModel: "avatar-v2", enabled: true, priority: 2 },
                    { id: "primary-binding", channelId: "primary", upstreamModel: "avatar-v1", enabled: true, priority: 1 },
                ],
            },
            {
                id: "image-human-only",
                name: "Image Human",
                capability: "video" as const,
                enabled: true,
                appKeys: ["image-human" as const],
                bindings: [{ id: "image-binding", channelId: "primary", upstreamModel: "avatar-v1", enabled: true, priority: 1 }],
            },
            {
                id: "disabled-avatar",
                name: "Disabled Avatar",
                capability: "video" as const,
                enabled: false,
                appKeys: ["aigc-digital-human" as const],
                bindings: [{ id: "disabled-binding", channelId: "primary", upstreamModel: "avatar-v1", enabled: true, priority: 1 }],
            },
            {
                id: "not-ready-avatar",
                name: "Not Ready Avatar",
                capability: "video" as const,
                enabled: true,
                appKeys: ["aigc-digital-human" as const],
                bindings: [{ id: "missing-binding", channelId: "missing", upstreamModel: "avatar-v3", enabled: true, priority: 1 }],
            },
        ],
        systemChannels: [
            { id: "primary", name: "Primary", baseUrl: "https://primary.example.com", apiKey: "secret", apiFormat: "openai" as const, models: ["avatar-v1"], enabled: true },
            { id: "backup", name: "Backup", baseUrl: "https://backup.example.com", apiKey: "secret", apiFormat: "openai" as const, models: ["avatar-v2"], enabled: true },
        ],
    } satisfies Pick<AuthSettings, "logicalModels" | "systemChannels">;
}

describe("SpecializedProviderBindingService", () => {
    it("lists only ready logical APIs scoped to the installed application", async () => {
        const service = new SpecializedProviderBindingService(createRepository(), async () => routingSettings());

        await expect(service.listTenantAppLogicalApis("tenant-a", "aigc-digital-human")).resolves.toEqual([
            { logicalModelKey: "avatar-pro", name: "Avatar Pro" },
        ]);
    });

    it("stores one validated logical API without exposing physical channels", async () => {
        const repository = createRepository({ saveProviderBinding: vi.fn().mockResolvedValue(providerBinding()) });
        const service = new SpecializedProviderBindingService(repository, async () => routingSettings());

        await expect(service.saveTenantAppProviderBinding("tenant-a", "aigc-digital-human", "avatar-pro", "user-a")).resolves.toEqual({
            logicalModelKey: "avatar-pro",
            name: "Avatar Pro",
            status: "enabled",
        });
        expect(repository.saveProviderBinding).toHaveBeenCalledWith("tenant-a", "aigc-digital-human", {
            logicalModelKey: "avatar-pro",
            status: "enabled",
            boundBy: "user-a",
        });
    });

    it("requires a configured binding before production resolution", async () => {
        const service = new SpecializedProviderBindingService(createRepository(), async () => routingSettings());

        await expect(service.resolveTenantAppProviderCandidates("tenant-a", "aigc-digital-human")).rejects.toMatchObject({
            code: "PROVIDER_NOT_BOUND",
        });
    });

    it("rejects a binding whose logical API has been disabled", async () => {
        const repository = createRepository({ getProviderBinding: vi.fn().mockResolvedValue(providerBinding("disabled-avatar")) });
        const service = new SpecializedProviderBindingService(repository, async () => routingSettings());

        await expect(service.resolveTenantAppProviderCandidates("tenant-a", "aigc-digital-human")).rejects.toMatchObject({
            code: "LOGICAL_API_DISABLED",
        });
    });

    it("requires an enabled tenant application and returns ordered internal candidates without mutating settings", async () => {
        const settings = routingSettings();
        const snapshot = structuredClone(settings);
        const repository = createRepository({ getProviderBinding: vi.fn().mockResolvedValue(providerBinding()) });
        const service = new SpecializedProviderBindingService(repository, async () => settings);

        const candidates = await service.resolveTenantAppProviderCandidates("tenant-a", "aigc-digital-human");

        expect(candidates.map((candidate) => candidate.channelId)).toEqual(["primary", "backup"]);
        expect(settings).toEqual(snapshot);

        repository.getTenantApp = vi.fn().mockResolvedValue(tenantApp("disabled"));
        await expect(service.resolveTenantAppProviderCandidates("tenant-a", "aigc-digital-human")).rejects.toMatchObject({
            code: "APP_DISABLED",
        });
    });
});
