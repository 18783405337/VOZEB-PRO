import { getAuthSettings } from "@/lib/auth/store";
import type { AuthSettings, LogicalModel } from "@/lib/auth/store";
import type { AppCenterRepository } from "@/lib/server/database/app-center-repository";
import { resolveLogicalModelCandidates, type ResolvedLogicalModel } from "@/lib/server/logical-model-router";

import { AppCenterService } from "./app-center-service";

type RoutingSettings = Pick<AuthSettings, "logicalModels" | "systemChannels">;
type SettingsLoader = () => Promise<RoutingSettings>;
type CandidateResolver = typeof resolveLogicalModelCandidates;

export type TenantLogicalApi = Readonly<{
    logicalModelKey: string;
    name: string;
}>;

export type TenantProviderBindingDto = TenantLogicalApi &
    Readonly<{
        status: "enabled";
    }>;

export type SpecializedProviderBindingErrorCode =
    | "PROVIDER_NOT_BOUND"
    | "LOGICAL_API_NOT_FOUND"
    | "LOGICAL_API_DISABLED"
    | "LOGICAL_API_CAPABILITY_MISMATCH"
    | "LOGICAL_API_APP_MISMATCH"
    | "LOGICAL_API_NOT_READY";

export class SpecializedProviderBindingError extends Error {
    constructor(
        message: string,
        readonly code: SpecializedProviderBindingErrorCode,
    ) {
        super(message);
        this.name = "SpecializedProviderBindingError";
    }
}

export class SpecializedProviderBindingService {
    private readonly appCenter: AppCenterService;

    constructor(
        private readonly repository: AppCenterRepository,
        private readonly loadSettings: SettingsLoader = getAuthSettings,
        private readonly resolveCandidates: CandidateResolver = resolveLogicalModelCandidates,
    ) {
        this.appCenter = new AppCenterService(repository);
    }

    async listTenantAppLogicalApis(tenantId: string, appKey: string): Promise<TenantLogicalApi[]> {
        await this.appCenter.requireTenantApp(tenantId, appKey);
        const settings = await this.loadSettings();
        return settings.logicalModels
            .filter((model) => model.enabled && model.capability === "video" && modelSupportsApp(model, appKey))
            .filter((model) => this.resolveCandidates(settings, "video", model.id).length > 0)
            .map(logicalApiDto);
    }

    async getTenantAppProviderBinding(tenantId: string, appKey: string): Promise<TenantProviderBindingDto | null> {
        await this.appCenter.requireTenantApp(tenantId, appKey);
        const binding = await this.repository.getProviderBinding(tenantId, appKey);
        if (!binding || binding.status !== "enabled") return null;

        const settings = await this.loadSettings();
        const { model } = this.requireReadyLogicalApi(settings, appKey, binding.logicalModelKey);
        return providerBindingDto(model);
    }

    async saveTenantAppProviderBinding(tenantId: string, appKey: string, logicalModelKey: string, userId: string): Promise<TenantProviderBindingDto> {
        await this.appCenter.requireTenantApp(tenantId, appKey);
        const settings = await this.loadSettings();
        const { model } = this.requireReadyLogicalApi(settings, appKey, logicalModelKey);
        await this.repository.saveProviderBinding(tenantId, appKey, {
            logicalModelKey: model.id,
            status: "enabled",
            boundBy: userId,
        });
        return providerBindingDto(model);
    }

    async clearTenantAppProviderBinding(tenantId: string, appKey: string): Promise<void> {
        await this.appCenter.requireTenantApp(tenantId, appKey);
        await this.repository.clearProviderBinding(tenantId, appKey);
    }

    async resolveTenantAppProviderCandidates(tenantId: string, appKey: string): Promise<ResolvedLogicalModel[]> {
        await this.appCenter.requireEnabledTenantApp(tenantId, appKey);
        const binding = await this.repository.getProviderBinding(tenantId, appKey);
        if (!binding || binding.status !== "enabled") {
            throw new SpecializedProviderBindingError("Tenant application provider is not bound", "PROVIDER_NOT_BOUND");
        }

        const settings = await this.loadSettings();
        return this.requireReadyLogicalApi(settings, appKey, binding.logicalModelKey).candidates;
    }

    private requireReadyLogicalApi(settings: RoutingSettings, appKey: string, logicalModelKey: string) {
        const requested = logicalModelKey.trim().toLowerCase();
        const model = settings.logicalModels.find((item) => item.id.toLowerCase() === requested);
        if (!model) throw new SpecializedProviderBindingError("Logical API was not found", "LOGICAL_API_NOT_FOUND");
        if (!model.enabled) throw new SpecializedProviderBindingError("Logical API is disabled", "LOGICAL_API_DISABLED");
        if (model.capability !== "video") {
            throw new SpecializedProviderBindingError("Logical API does not provide video capability", "LOGICAL_API_CAPABILITY_MISMATCH");
        }
        if (!modelSupportsApp(model, appKey)) {
            throw new SpecializedProviderBindingError("Logical API is not available for this application", "LOGICAL_API_APP_MISMATCH");
        }

        const candidates = this.resolveCandidates(settings, "video", model.id);
        if (!candidates.length) throw new SpecializedProviderBindingError("Logical API has no ready provider channel", "LOGICAL_API_NOT_READY");
        return { model, candidates };
    }
}

function modelSupportsApp(model: LogicalModel, appKey: string) {
    return model.appKeys?.some((item) => item === appKey) === true;
}

function logicalApiDto(model: LogicalModel): TenantLogicalApi {
    return { logicalModelKey: model.id, name: model.name };
}

function providerBindingDto(model: LogicalModel): TenantProviderBindingDto {
    return { ...logicalApiDto(model), status: "enabled" };
}
