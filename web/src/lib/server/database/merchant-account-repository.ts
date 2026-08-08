import { randomUUID } from "node:crypto";

import type { QueryExecutor } from "@/lib/server/database/postgres";

import { jsonValue, numberValue, optionalString, stringValue } from "./repository-shared";

export type MerchantAccountOwnerType = "platform" | "tenant";
export type MerchantAccountEnvironment = "test" | "production";
export type MerchantAccountStatus = "enabled" | "disabled";

export type MerchantAccountOwnerScope = Readonly<{
    ownerType: MerchantAccountOwnerType;
    ownerId: string;
    tenantId?: string;
}>;

export type MerchantAccountRecord = Readonly<{
    id: string;
    ownerType: MerchantAccountOwnerType;
    ownerId: string;
    tenantId?: string;
    provider: string;
    environment: MerchantAccountEnvironment;
    status: MerchantAccountStatus;
    encryptedConfig: string;
    configuredFields: string[];
    webhookIdentity: string;
    bootstrapIdempotencyKey?: string;
    createdAt: number;
    updatedAt: number;
}>;

export type SaveMerchantAccountRecordInput = Omit<MerchantAccountRecord, "createdAt" | "updatedAt">;
export type DisableMerchantAccountInput = Readonly<{
    id: string;
    ownerType: MerchantAccountOwnerType;
    ownerId: string;
}>;

export type MerchantAccountTransactionRunner = <T>(handler: (executor: QueryExecutor) => Promise<T>) => Promise<T>;

export interface MerchantAccountRepositoryPort {
    list(scope: MerchantAccountOwnerScope): Promise<MerchantAccountRecord[]>;
    getById(id: string): Promise<MerchantAccountRecord | null>;
    getEnabled(scope: MerchantAccountOwnerScope, provider: string, environment: MerchantAccountEnvironment): Promise<MerchantAccountRecord | null>;
    getEnabledByWebhookIdentity(provider: string, environment: MerchantAccountEnvironment, webhookIdentity: string): Promise<MerchantAccountRecord | null>;
    save(input: SaveMerchantAccountRecordInput): Promise<MerchantAccountRecord>;
    disable(input: DisableMerchantAccountInput): Promise<MerchantAccountRecord | null>;
}

export class MerchantAccountRepository implements MerchantAccountRepositoryPort {
    private readonly transaction: MerchantAccountTransactionRunner;

    constructor(
        private readonly db: QueryExecutor,
        transaction?: MerchantAccountTransactionRunner,
    ) {
        this.transaction = transaction || (async (handler) => handler(this.db));
    }

    async list(scope: MerchantAccountOwnerScope) {
        const result = await this.db.query(
            `SELECT * FROM merchant_accounts
             WHERE owner_type = $1
               AND owner_id = $2
               AND tenant_id IS NOT DISTINCT FROM $3
             ORDER BY updated_at DESC, created_at DESC`,
            [scope.ownerType, scope.ownerId, scope.tenantId || null],
        );
        return result.rows.map(mapMerchantAccount);
    }

    async getById(id: string) {
        const result = await this.db.query("SELECT * FROM merchant_accounts WHERE id = $1", [id]);
        return result.rows[0] ? mapMerchantAccount(result.rows[0]) : null;
    }

    async getEnabled(scope: MerchantAccountOwnerScope, provider: string, environment: MerchantAccountEnvironment) {
        const result = await this.db.query(
            `SELECT * FROM merchant_accounts
             WHERE owner_type = $1
               AND owner_id = $2
               AND tenant_id IS NOT DISTINCT FROM $3
               AND provider = $4
               AND environment = $5
               AND status = 'enabled'
             ORDER BY updated_at DESC, created_at DESC
             LIMIT 1`,
            [scope.ownerType, scope.ownerId, scope.tenantId || null, provider, environment],
        );
        return result.rows[0] ? mapMerchantAccount(result.rows[0]) : null;
    }

    async getEnabledByWebhookIdentity(provider: string, environment: MerchantAccountEnvironment, webhookIdentity: string) {
        const result = await this.db.query(
            `SELECT * FROM merchant_accounts
             WHERE provider = $1
               AND environment = $2
               AND webhook_identity = $3
               AND status = 'enabled'
             LIMIT 1`,
            [provider, environment, webhookIdentity],
        );
        return result.rows[0] ? mapMerchantAccount(result.rows[0]) : null;
    }

    async save(input: SaveMerchantAccountRecordInput) {
        return this.transaction(async (db) => {
            const id = input.id || randomUUID();
            const tenantId = input.ownerType === "tenant" ? input.tenantId || input.ownerId : null;
            const now = Date.now();

            await db.query(
                "SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':' || $3 || ':' || $4))",
                [input.ownerType, input.ownerId, input.provider, input.environment],
            );

            if (input.status === "enabled") {
                await db.query(
                    `UPDATE merchant_accounts
                     SET status = 'disabled', updated_at = $6
                     WHERE owner_type = $1
                       AND owner_id = $2
                       AND provider = $3
                       AND environment = $4
                       AND id <> $5
                       AND status = 'enabled'`,
                    [input.ownerType, input.ownerId, input.provider, input.environment, id, now],
                );
            }

            const result = await db.query(
                `INSERT INTO merchant_accounts (
                    id, owner_type, owner_id, tenant_id, provider, environment, status,
                    encrypted_config, configured_fields_json, webhook_identity,
                    bootstrap_idempotency_key, created_at, updated_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $12)
                 ON CONFLICT (bootstrap_idempotency_key) WHERE bootstrap_idempotency_key IS NOT NULL
                 DO UPDATE SET
                    owner_type = EXCLUDED.owner_type,
                    owner_id = EXCLUDED.owner_id,
                    tenant_id = EXCLUDED.tenant_id,
                    provider = EXCLUDED.provider,
                    environment = EXCLUDED.environment,
                    status = EXCLUDED.status,
                    encrypted_config = EXCLUDED.encrypted_config,
                    configured_fields_json = EXCLUDED.configured_fields_json,
                    webhook_identity = EXCLUDED.webhook_identity,
                    updated_at = EXCLUDED.updated_at
                 RETURNING *`,
                [
                    id,
                    input.ownerType,
                    input.ownerId,
                    tenantId,
                    input.provider,
                    input.environment,
                    input.status,
                    input.encryptedConfig,
                    JSON.stringify(input.configuredFields),
                    input.webhookIdentity,
                    input.bootstrapIdempotencyKey || null,
                    now,
                ],
            );
            if (!result.rows[0]) throw new Error("Merchant account save did not return a record");
            return mapMerchantAccount(result.rows[0]);
        });
    }

    async disable(input: DisableMerchantAccountInput) {
        const result = await this.db.query(
            `UPDATE merchant_accounts
             SET status = 'disabled', updated_at = $4
             WHERE id = $1 AND owner_type = $2 AND owner_id = $3
             RETURNING *`,
            [input.id, input.ownerType, input.ownerId, Date.now()],
        );
        return result.rows[0] ? mapMerchantAccount(result.rows[0]) : null;
    }
}

function mapMerchantAccount(row: Record<string, unknown>): MerchantAccountRecord {
    const ownerType = stringValue(row.owner_type);
    const environment = stringValue(row.environment);
    const status = stringValue(row.status);
    return {
        id: stringValue(row.id),
        ownerType: ownerType === "tenant" ? "tenant" : "platform",
        ownerId: stringValue(row.owner_id),
        tenantId: optionalString(row.tenant_id),
        provider: stringValue(row.provider),
        environment: environment === "production" ? "production" : "test",
        status: status === "disabled" ? "disabled" : "enabled",
        encryptedConfig: stringValue(row.encrypted_config),
        configuredFields: stringArray(jsonValue(row.configured_fields_json)),
        webhookIdentity: stringValue(row.webhook_identity),
        bootstrapIdempotencyKey: optionalString(row.bootstrap_idempotency_key),
        createdAt: numberValue(row.created_at),
        updatedAt: numberValue(row.updated_at),
    };
}

function stringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
