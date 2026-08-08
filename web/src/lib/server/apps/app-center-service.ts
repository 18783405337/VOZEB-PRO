import type { AppDefinition, AppField } from "@/lib/apps/app-definition";
import { appRegistry, type AppRegistry } from "@/lib/apps/app-registry";
import type {
    AppCenterRepository,
    InstallTenantAppInput,
    PublishAppVersionInput,
    TenantApp,
    TenantAppPricingInput,
    TenantAppSettingsInput,
} from "@/lib/server/database/app-center-repository";

export class AppCenterServiceError extends Error {
    constructor(
        message: string,
        readonly code:
            | "APP_CENTER_UNAVAILABLE"
            | "APP_DEFINITION_MISMATCH"
            | "APP_NOT_FOUND"
            | "APP_NOT_PUBLISHED"
            | "APP_NOT_INSTALLED"
            | "APP_DISABLED"
            | "APP_WORKFLOW_MISMATCH"
            | "APP_OUTPUT_MISMATCH"
            | "APP_SETTING_INVALID",
    ) {
        super(message);
        this.name = "AppCenterServiceError";
    }
}

export class AppCenterService {
    constructor(
        private readonly repository: AppCenterRepository,
        private readonly registry: AppRegistry = appRegistry,
    ) {}

    async publishAppVersion(input: Readonly<{ appKey: string; version: string; definition?: AppDefinition; publishedAt?: number }>) {
        const reviewed = this.getReviewedDefinition(input.appKey, input.version);
        if (input.definition && !sameDefinition(input.definition, reviewed)) {
            throw new AppCenterServiceError("Application definition differs from reviewed registry", "APP_DEFINITION_MISMATCH");
        }

        const existing = await this.repository.getPublished(reviewed.key, reviewed.version);
        if (existing) {
            if (!sameDefinition(existing.definition, reviewed)) {
                throw new AppCenterServiceError("Published application definition differs from reviewed registry", "APP_DEFINITION_MISMATCH");
            }
            return existing;
        }

        const publishInput: PublishAppVersionInput = { definition: reviewed, publishedAt: input.publishedAt };
        return this.repository.publish(publishInput);
    }

    async installTenantApp(tenantId: string, input: InstallTenantAppInput): Promise<TenantApp> {
        this.getReviewedDefinition(input.appKey, input.version);
        const published = await this.repository.getPublished(input.appKey, input.version);
        if (!published) throw new AppCenterServiceError("Application version is not published", "APP_NOT_PUBLISHED");
        if (!sameDefinition(published.definition, this.getReviewedDefinition(input.appKey, input.version))) {
            throw new AppCenterServiceError("Published application definition differs from reviewed registry", "APP_DEFINITION_MISMATCH");
        }
        return this.repository.install(tenantId, input);
    }

    async saveTenantAppSettings(tenantId: string, appKey: string, input: TenantAppSettingsInput) {
        const tenantApp = await this.repository.getTenantApp(tenantId, appKey);
        if (!tenantApp) throw new AppCenterServiceError("Application is not installed for this tenant", "APP_NOT_INSTALLED");
        this.validateSettings(tenantApp.definition.inputSchema, input.settings);
        validateSecretReferences(input.secretRefs);
        await this.repository.saveSettings(tenantId, tenantApp.id, input);
    }

    async saveTenantAppPricing(tenantId: string, appKey: string, input: TenantAppPricingInput) {
        const tenantApp = await this.repository.getTenantApp(tenantId, appKey);
        if (!tenantApp) throw new AppCenterServiceError("Application is not installed for this tenant", "APP_NOT_INSTALLED");
        if (!input.currency.trim() || !input.saleUnit.trim() || !Number.isSafeInteger(input.saleAmount) || input.saleAmount < 0) {
            throw new AppCenterServiceError("Application pricing is invalid", "APP_SETTING_INVALID");
        }
        await this.repository.savePricing(tenantId, tenantApp.id, input);
    }

    async setTenantAppStatus(tenantId: string, appKey: string, status: "enabled" | "disabled") {
        const tenantApp = await this.repository.getTenantApp(tenantId, appKey);
        if (!tenantApp) throw new AppCenterServiceError("Application is not installed for this tenant", "APP_NOT_INSTALLED");
        return this.repository.setStatus(tenantId, tenantApp.id, status);
    }

    async requireTenantApp(tenantId: string, appKey: string) {
        const tenantApp = await this.repository.getTenantApp(tenantId, appKey);
        if (!tenantApp) throw new AppCenterServiceError("Application is not installed for this tenant", "APP_NOT_INSTALLED");
        return tenantApp;
    }

    async requireEnabledTenantApp(tenantId: string, appKey: string, workflowKey?: string) {
        const tenantApp = await this.requireTenantApp(tenantId, appKey);
        if (tenantApp.status !== "enabled") throw new AppCenterServiceError("Application is disabled for this tenant", "APP_DISABLED");
        if (workflowKey && tenantApp.definition.workflowKey !== workflowKey) {
            throw new AppCenterServiceError("Application workflow does not match the requested runtime", "APP_WORKFLOW_MISMATCH");
        }
        return tenantApp;
    }

    private getReviewedDefinition(appKey: string, version: string) {
        const definition = this.registry.get(appKey, version);
        if (!definition) throw new AppCenterServiceError("Reviewed application version was not found", "APP_NOT_FOUND");
        return definition;
    }

    private validateSettings(fields: readonly AppField[], settings: Record<string, unknown>) {
        const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
        for (const [key, value] of Object.entries(settings)) {
            const field = fieldsByKey.get(key);
            if (!field) throw new AppCenterServiceError(`Unsupported application setting: ${key}`, "APP_SETTING_INVALID");
            if (!matchesFieldValue(field, value)) throw new AppCenterServiceError(`Invalid value for application setting: ${key}`, "APP_SETTING_INVALID");
        }
    }
}

function matchesFieldValue(field: AppField, value: unknown) {
    if (field.kind === "number") {
        return typeof value === "number" && Number.isFinite(value) && (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
    }
    if (typeof value !== "string") return false;
    if (field.kind === "text") return field.maxLength === undefined || value.length <= field.maxLength;
    if (field.kind === "select") return field.options.includes(value);
    return Boolean(value.trim());
}

function validateSecretReferences(secretRefs: Record<string, string>) {
    if (Object.values(secretRefs).some((value) => typeof value !== "string" || !value.trim())) {
        throw new AppCenterServiceError("Application secret references are invalid", "APP_SETTING_INVALID");
    }
}

function sameDefinition(left: AppDefinition, right: AppDefinition) {
    return stableStringify(left) === stableStringify(right);
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}
