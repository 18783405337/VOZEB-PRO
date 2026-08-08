import { randomUUID } from "node:crypto";

import type { AppDefinition } from "@/lib/apps/app-definition";
import type { QueryExecutor } from "@/lib/server/database/postgres";

import { numberValue, stringValue } from "./repository-shared";

export type TenantAppStatus = "enabled" | "disabled";
export type TenantAppCollectionMode = "platform" | "tenant";
export type TenantAppProviderBindingStatus = "enabled" | "disabled";

export type PublishedAppVersion = Readonly<{
    id: string;
    appId: string;
    appKey: string;
    version: string;
    definition: AppDefinition;
    publishedAt: number;
}>;

export type PublishAppVersionInput = Readonly<{
    definition: AppDefinition;
    publishedAt?: number;
}>;

export type TenantApp = Readonly<{
    id: string;
    tenantId: string;
    appId: string;
    appKey: string;
    version: string;
    status: TenantAppStatus;
    installedBy: string;
    installedAt: number;
    updatedAt: number;
}>;

export type InstallTenantAppInput = Readonly<{
    appKey: string;
    version: string;
    installedBy: string;
    installedAt?: number;
}>;

export type TenantAppSettingsInput = Readonly<{
    settings: Record<string, unknown>;
    secretRefs: Record<string, string>;
    updatedBy: string;
    updatedAt?: number;
}>;

export type TenantAppPricingInput = Readonly<{
    currency: string;
    saleUnit: string;
    saleAmount: number;
    collectionMode: TenantAppCollectionMode;
    updatedBy: string;
    updatedAt?: number;
}>;

export type TenantAppPricing = Readonly<{
    currency: string;
    saleUnit: string;
    saleAmount: number;
    collectionMode: TenantAppCollectionMode;
    updatedBy: string;
    updatedAt: number;
}>;

export type TenantAppProviderBindingInput = Readonly<{
    logicalModelKey: string;
    status: TenantAppProviderBindingStatus;
    boundBy: string;
    updatedAt?: number;
}>;

export type TenantAppProviderBinding = Readonly<{
    id: string;
    tenantAppId: string;
    logicalModelKey: string;
    status: TenantAppProviderBindingStatus;
    boundBy: string;
    createdAt: number;
    updatedAt: number;
}>;

export type TenantAppDetails = TenantApp &
    Readonly<{
        definition: AppDefinition;
        settings: Record<string, unknown>;
        secretRefs: Record<string, string>;
        pricing: TenantAppPricing | null;
    }>;

export interface AppCenterRepository {
    publish(input: PublishAppVersionInput): Promise<PublishedAppVersion>;
    listPublished(): Promise<PublishedAppVersion[]>;
    getPublished(appKey: string, version?: string): Promise<PublishedAppVersion | null>;
    install(tenantId: string, input: InstallTenantAppInput): Promise<TenantApp>;
    setStatus(tenantId: string, tenantAppId: string, status: TenantAppStatus): Promise<TenantApp>;
    saveSettings(tenantId: string, tenantAppId: string, input: TenantAppSettingsInput): Promise<void>;
    savePricing(tenantId: string, tenantAppId: string, input: TenantAppPricingInput): Promise<void>;
    getProviderBinding(tenantId: string, appKey: string): Promise<TenantAppProviderBinding | null>;
    saveProviderBinding(tenantId: string, appKey: string, input: TenantAppProviderBindingInput): Promise<TenantAppProviderBinding>;
    clearProviderBinding(tenantId: string, appKey: string): Promise<void>;
    getTenantApp(tenantId: string, appKey: string): Promise<TenantAppDetails | null>;
    listTenantApps(tenantId: string): Promise<TenantAppDetails[]>;
}

export type AppCenterTransactionRunner = <T>(handler: (executor: QueryExecutor) => Promise<T>) => Promise<T>;

export class AppCenterPostgresRepository implements AppCenterRepository {
    private readonly transaction: AppCenterTransactionRunner;

    constructor(
        private readonly db: QueryExecutor,
        transaction?: AppCenterTransactionRunner,
    ) {
        this.transaction = transaction || ((handler) => handler(this.db));
    }

    async publish(input: PublishAppVersionInput): Promise<PublishedAppVersion> {
        const definition = input.definition;
        const now = input.publishedAt || Date.now();

        return this.transaction(async (executor) => {
            const appResult = await executor.query(
                `INSERT INTO apps (id, app_key, name, category, status, current_version, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, 'published', $5, $6, $6)
                 ON CONFLICT (app_key) DO UPDATE SET
                     name = EXCLUDED.name,
                     category = EXCLUDED.category,
                     status = 'published',
                     current_version = EXCLUDED.current_version,
                     updated_at = EXCLUDED.updated_at
                 RETURNING id, app_key`,
                [randomUUID(), definition.key, definition.name, definition.category, definition.version, now],
            );
            const app = appResult.rows[0];
            if (!app) throw new Error("Application publication did not return an application");

            const versionId = randomUUID();
            const versionResult = await executor.query(
                `INSERT INTO app_versions (id, app_id, version, workflow_key, renderer_key, definition_json, published_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)
                 ON CONFLICT (app_id, version) DO NOTHING
                 RETURNING id, app_id, version, definition_json, published_at`,
                [versionId, stringValue(app.id), definition.version, definition.workflowKey, rendererKey(definition), JSON.stringify(definition), now],
            );

            if (versionResult.rows[0]) return mapPublishedAppVersion({ ...versionResult.rows[0], app_key: app.app_key });

            const existing = await executor.query(
                `SELECT av.id, av.app_id, a.app_key, av.version, av.definition_json, av.published_at
                 FROM app_versions av
                 JOIN apps a ON a.id = av.app_id
                 WHERE av.app_id = $1 AND av.version = $2`,
                [stringValue(app.id), definition.version],
            );
            if (!existing.rows[0]) throw new Error("Application publication did not return a version");
            return mapPublishedAppVersion(existing.rows[0]);
        });
    }

    async listPublished(): Promise<PublishedAppVersion[]> {
        const result = await this.db.query(
            `SELECT av.id, av.app_id, a.app_key, av.version, av.definition_json, av.published_at
             FROM app_versions av
             JOIN apps a ON a.id = av.app_id
             WHERE a.status = 'published' AND av.published_at IS NOT NULL
             ORDER BY a.app_key ASC, av.published_at DESC, av.version DESC`,
        );
        return result.rows.map(mapPublishedAppVersion);
    }

    async getPublished(appKey: string, version?: string): Promise<PublishedAppVersion | null> {
        const result = await this.db.query(
            `SELECT av.id, av.app_id, a.app_key, av.version, av.definition_json, av.published_at
             FROM apps a
             JOIN app_versions av ON av.app_id = a.id
             WHERE a.app_key = $1
               AND a.status = 'published'
               AND av.published_at IS NOT NULL
               AND ($2::text IS NULL OR av.version = $2)
             ORDER BY av.published_at DESC, av.version DESC
             LIMIT 1`,
            [appKey, version || null],
        );
        return result.rows[0] ? mapPublishedAppVersion(result.rows[0]) : null;
    }

    async install(tenantId: string, input: InstallTenantAppInput): Promise<TenantApp> {
        const now = input.installedAt || Date.now();
        const result = await this.db.query(
            `INSERT INTO tenant_apps (id, tenant_id, app_id, selected_version_id, status, installed_by, installed_at, updated_at)
             SELECT $2, $1, a.id, av.id, 'enabled', $5, $6, $6
             FROM apps a
             JOIN app_versions av ON av.app_id = a.id
             WHERE a.app_key = $3
               AND a.status = 'published'
               AND av.version = $4
               AND av.published_at IS NOT NULL
             ON CONFLICT (tenant_id, app_id) DO NOTHING
             RETURNING id, tenant_id, app_id, installed_by, installed_at, updated_at`,
            [tenantId, randomUUID(), input.appKey, input.version, input.installedBy, now],
        );
        if (!result.rows[0]) throw new Error("Tenant application is already installed or application version is not published");
        return mapTenantApp({ ...result.rows[0], app_key: input.appKey, version: input.version, status: "enabled" });
    }

    async setStatus(tenantId: string, tenantAppId: string, status: TenantAppStatus): Promise<TenantApp> {
        const now = Date.now();
        const result = await this.db.query(
            `WITH updated AS (
                 UPDATE tenant_apps
                 SET status = $3, updated_at = $4
                 WHERE tenant_id = $1 AND id = $2
                 RETURNING *
             )
             SELECT updated.*, a.app_key, av.version
             FROM updated
             JOIN apps a ON a.id = updated.app_id
             JOIN app_versions av ON av.id = updated.selected_version_id`,
            [tenantId, tenantAppId, status, now],
        );
        if (!result.rows[0]) throw new Error("Tenant application was not found");
        return mapTenantApp(result.rows[0]);
    }

    async saveSettings(tenantId: string, tenantAppId: string, input: TenantAppSettingsInput): Promise<void> {
        const now = input.updatedAt || Date.now();
        const result = await this.db.query(
            `INSERT INTO tenant_app_settings (id, tenant_app_id, settings_json, secret_refs_json, updated_by, updated_at)
             SELECT $3, ta.id, $4::jsonb, $5::jsonb, $6, $7
             FROM tenant_apps ta
             WHERE ta.tenant_id = $1 AND ta.id = $2
             ON CONFLICT (tenant_app_id) DO UPDATE SET
                 settings_json = EXCLUDED.settings_json,
                 secret_refs_json = EXCLUDED.secret_refs_json,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = EXCLUDED.updated_at
             RETURNING tenant_app_id`,
            [tenantId, tenantAppId, randomUUID(), JSON.stringify(input.settings), JSON.stringify(input.secretRefs), input.updatedBy, now],
        );
        if (!result.rows[0]) throw new Error("Tenant application was not found");
    }

    async savePricing(tenantId: string, tenantAppId: string, input: TenantAppPricingInput): Promise<void> {
        const now = input.updatedAt || Date.now();
        const result = await this.db.query(
            `INSERT INTO tenant_app_pricing (id, tenant_app_id, currency, sale_unit, sale_amount, collection_mode, updated_by, updated_at)
             SELECT $3, ta.id, $4, $5, $6, $7, $8, $9
             FROM tenant_apps ta
             WHERE ta.tenant_id = $1 AND ta.id = $2
             ON CONFLICT (tenant_app_id) DO UPDATE SET
                 currency = EXCLUDED.currency,
                 sale_unit = EXCLUDED.sale_unit,
                 sale_amount = EXCLUDED.sale_amount,
                 collection_mode = EXCLUDED.collection_mode,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = EXCLUDED.updated_at
             RETURNING tenant_app_id`,
            [tenantId, tenantAppId, randomUUID(), input.currency, input.saleUnit, input.saleAmount, input.collectionMode, input.updatedBy, now],
        );
        if (!result.rows[0]) throw new Error("Tenant application was not found");
    }

    async getProviderBinding(tenantId: string, appKey: string): Promise<TenantAppProviderBinding | null> {
        const result = await this.db.query(
            `SELECT tapb.id, tapb.tenant_app_id, tapb.logical_model_key, tapb.status, tapb.bound_by, tapb.created_at, tapb.updated_at
             FROM tenant_app_provider_bindings tapb
             JOIN tenant_apps ta ON ta.id = tapb.tenant_app_id
             JOIN apps a ON a.id = ta.app_id
             WHERE ta.tenant_id = $1 AND a.app_key = $2`,
            [tenantId, appKey],
        );
        return result.rows[0] ? mapTenantAppProviderBinding(result.rows[0]) : null;
    }

    async saveProviderBinding(tenantId: string, appKey: string, input: TenantAppProviderBindingInput): Promise<TenantAppProviderBinding> {
        const now = input.updatedAt || Date.now();
        const result = await this.db.query(
            `INSERT INTO tenant_app_provider_bindings (id, tenant_app_id, logical_model_key, status, bound_by, created_at, updated_at)
             SELECT $3, ta.id, $4, $5, $6, $7, $7
             FROM tenant_apps ta
             JOIN apps a ON a.id = ta.app_id
             WHERE ta.tenant_id = $1 AND a.app_key = $2
             ON CONFLICT (tenant_app_id) DO UPDATE SET
                 logical_model_key = EXCLUDED.logical_model_key,
                 status = EXCLUDED.status,
                 bound_by = EXCLUDED.bound_by,
                 updated_at = EXCLUDED.updated_at
             RETURNING id, tenant_app_id, logical_model_key, status, bound_by, created_at, updated_at`,
            [tenantId, appKey, randomUUID(), input.logicalModelKey, input.status, input.boundBy, now],
        );
        if (!result.rows[0]) throw new Error("Tenant application was not found");
        return mapTenantAppProviderBinding(result.rows[0]);
    }

    async clearProviderBinding(tenantId: string, appKey: string): Promise<void> {
        await this.db.query(
            `DELETE FROM tenant_app_provider_bindings tapb
             USING tenant_apps ta
             JOIN apps a ON a.id = ta.app_id
             WHERE tapb.tenant_app_id = ta.id
               AND ta.tenant_id = $1
               AND a.app_key = $2`,
            [tenantId, appKey],
        );
    }

    async getTenantApp(tenantId: string, appKey: string): Promise<TenantAppDetails | null> {
        const result = await this.db.query(
            `${tenantAppDetailsSql()}
             WHERE ta.tenant_id = $1 AND a.app_key = $2`,
            [tenantId, appKey],
        );
        return result.rows[0] ? mapTenantAppDetails(result.rows[0]) : null;
    }

    async listTenantApps(tenantId: string): Promise<TenantAppDetails[]> {
        const result = await this.db.query(
            `${tenantAppDetailsSql()}
             WHERE ta.tenant_id = $1
             ORDER BY ta.updated_at DESC, a.app_key ASC`,
            [tenantId],
        );
        return result.rows.map(mapTenantAppDetails);
    }
}

function tenantAppDetailsSql() {
    return `SELECT ta.id, ta.tenant_id, ta.app_id, a.app_key, av.version, ta.status, ta.installed_by, ta.installed_at, ta.updated_at,
                   av.definition_json, tas.settings_json, tas.secret_refs_json,
                   tap.currency AS pricing_currency, tap.sale_unit AS pricing_sale_unit, tap.sale_amount AS pricing_sale_amount,
                   tap.collection_mode AS pricing_collection_mode, tap.updated_by AS pricing_updated_by, tap.updated_at AS pricing_updated_at
            FROM tenant_apps ta
            JOIN apps a ON a.id = ta.app_id
            JOIN app_versions av ON av.id = ta.selected_version_id
            LEFT JOIN tenant_app_settings tas ON tas.tenant_app_id = ta.id
            LEFT JOIN tenant_app_pricing tap ON tap.tenant_app_id = ta.id`;
}

function mapPublishedAppVersion(row: Record<string, unknown>): PublishedAppVersion {
    return {
        id: stringValue(row.id),
        appId: stringValue(row.app_id),
        appKey: stringValue(row.app_key),
        version: stringValue(row.version),
        definition: appDefinitionValue(row.definition_json),
        publishedAt: numberValue(row.published_at),
    };
}

function mapTenantApp(row: Record<string, unknown>): TenantApp {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        appId: stringValue(row.app_id),
        appKey: stringValue(row.app_key),
        version: stringValue(row.version),
        status: row.status === "disabled" ? "disabled" : "enabled",
        installedBy: stringValue(row.installed_by),
        installedAt: numberValue(row.installed_at),
        updatedAt: numberValue(row.updated_at),
    };
}

function mapTenantAppProviderBinding(row: Record<string, unknown>): TenantAppProviderBinding {
    return {
        id: stringValue(row.id),
        tenantAppId: stringValue(row.tenant_app_id),
        logicalModelKey: stringValue(row.logical_model_key),
        status: row.status === "disabled" ? "disabled" : "enabled",
        boundBy: stringValue(row.bound_by),
        createdAt: numberValue(row.created_at),
        updatedAt: numberValue(row.updated_at),
    };
}

function mapTenantAppDetails(row: Record<string, unknown>): TenantAppDetails {
    const pricing = stringValue(row.pricing_currency)
        ? {
              currency: stringValue(row.pricing_currency),
              saleUnit: stringValue(row.pricing_sale_unit),
              saleAmount: numberValue(row.pricing_sale_amount),
              collectionMode: (row.pricing_collection_mode === "tenant" ? "tenant" : "platform") as TenantAppCollectionMode,
              updatedBy: stringValue(row.pricing_updated_by),
              updatedAt: numberValue(row.pricing_updated_at),
          }
        : null;
    return {
        ...mapTenantApp(row),
        definition: appDefinitionValue(row.definition_json),
        settings: recordValue(row.settings_json),
        secretRefs: stringRecordValue(row.secret_refs_json),
        pricing,
    };
}

function appDefinitionValue(value: unknown): AppDefinition {
    const record = recordValue(value);
    if (!stringValue(record.key) || !stringValue(record.version)) throw new Error("Stored application definition is invalid");
    return record as AppDefinition;
}

function recordValue(value: unknown): Record<string, unknown> {
    if (typeof value === "string") {
        try {
            return recordValue(JSON.parse(value));
        } catch {
            return {};
        }
    }
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringRecordValue(value: unknown): Record<string, string> {
    return Object.fromEntries(Object.entries(recordValue(value)).flatMap(([key, entry]) => (typeof entry === "string" ? [[key, entry]] : [])));
}

function rendererKey(definition: AppDefinition) {
    return definition.renderer.kind === "custom" ? definition.renderer.key : "schema";
}
