import { randomUUID } from "node:crypto";

import { PAYMENT_PROVIDER_DEFINITIONS, type PaymentProviderDefinition } from "@/lib/payment-config-types";
import { BillingInputError } from "@/lib/server/billing-errors";
import { encryptSecretValue } from "@/lib/server/secret-crypto";
import type {
    MerchantAccountEnvironment,
    MerchantAccountOwnerScope,
    MerchantAccountRecord,
    MerchantAccountRepositoryPort,
    MerchantAccountStatus,
    SaveMerchantAccountRecordInput,
} from "@/lib/server/database/merchant-account-repository";

export type MerchantAccountSummary = {
    id: string;
    ownerType: "platform" | "tenant";
    provider: string;
    environment: "test" | "production";
    status: "enabled" | "disabled";
    configuredFields: string[];
};

export type SaveMerchantAccountInput = {
    provider: string;
    environment: MerchantAccountEnvironment;
    credentials: Record<string, string>;
    webhookIdentity: string;
};

export type MerchantAccountServicePort = {
    list(scope: MerchantAccountOwnerScope): Promise<MerchantAccountSummary[]>;
    save(scope: MerchantAccountOwnerScope, input: SaveMerchantAccountInput): Promise<MerchantAccountSummary>;
    disable(scope: MerchantAccountOwnerScope, id: string): Promise<MerchantAccountSummary>;
};

export class MerchantAccountService implements MerchantAccountServicePort {
    constructor(private readonly repository: MerchantAccountRepositoryPort) {}

    async list(scope: MerchantAccountOwnerScope) {
        return (await this.repository.list(scope)).map(toSummary);
    }

    async save(scope: MerchantAccountOwnerScope, input: SaveMerchantAccountInput) {
        return toSummary(await this.saveRecord(scope, input, "enabled"));
    }

    async bootstrapLegacy(
        scope: MerchantAccountOwnerScope,
        input: SaveMerchantAccountInput,
        bootstrapIdempotencyKey: string,
        status: MerchantAccountStatus,
    ) {
        return toSummary(await this.saveRecord(scope, input, status, bootstrapIdempotencyKey));
    }

    async disable(scope: MerchantAccountOwnerScope, id: string) {
        const merchant = await this.repository.disable({ id, ownerType: scope.ownerType, ownerId: scope.ownerId });
        if (!merchant) throw new BillingInputError("Merchant account was not found", 404);
        return toSummary(merchant);
    }

    private async saveRecord(scope: MerchantAccountOwnerScope, input: SaveMerchantAccountInput, status: MerchantAccountStatus, bootstrapIdempotencyKey?: string) {
        const definition = findProviderDefinition(input.provider);
        const credentials = normalizeCredentials(definition, input.credentials);
        const webhookIdentity = normalizeWebhookIdentity(input.webhookIdentity);
        const record: SaveMerchantAccountRecordInput = {
            id: randomUUID(),
            ownerType: scope.ownerType,
            ownerId: scope.ownerId,
            ...(scope.ownerType === "tenant" ? { tenantId: scope.tenantId || scope.ownerId } : {}),
            provider: definition.id,
            environment: input.environment,
            status,
            encryptedConfig: encryptSecretValue(JSON.stringify(credentials)),
            configuredFields: Object.keys(credentials),
            webhookIdentity,
            ...(bootstrapIdempotencyKey ? { bootstrapIdempotencyKey } : {}),
        };
        return this.repository.save(record);
    }
}

function findProviderDefinition(provider: string) {
    const definition = PAYMENT_PROVIDER_DEFINITIONS.find((item) => item.id === provider);
    if (!definition) throw new BillingInputError(`Unsupported payment provider: ${provider}`);
    return definition;
}

function normalizeCredentials(definition: PaymentProviderDefinition, input: Record<string, string>) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new BillingInputError("credentials must be a JSON object");

    const allowed = new Map(definition.fields.map((field) => [field.key, field]));
    const credentials: Record<string, string> = {};
    for (const [key, raw] of Object.entries(input)) {
        const field = allowed.get(key);
        if (!field) throw new BillingInputError(`Unsupported credential field: ${key}`);
        if (typeof raw !== "string") throw new BillingInputError(`Credential field must be text: ${key}`);
        const value = raw.trim().slice(0, field.kind === "textarea" ? 20_000 : 2_000);
        if (field.options?.length && value && !field.options.some((option) => option.value === value)) {
            throw new BillingInputError(`Invalid credential field: ${key}`);
        }
        if (value) credentials[key] = value;
    }

    for (const field of definition.fields) {
        if (field.required && !credentials[field.key]) throw new BillingInputError(`Required credential field is missing: ${field.key}`);
    }
    return credentials;
}

function normalizeWebhookIdentity(value: string) {
    if (typeof value !== "string") throw new BillingInputError("webhookIdentity is required");
    const normalized = value.trim();
    if (!normalized || normalized.length > 200) throw new BillingInputError("webhookIdentity is invalid");
    return normalized;
}

function toSummary(record: MerchantAccountRecord): MerchantAccountSummary {
    return {
        id: record.id,
        ownerType: record.ownerType,
        provider: record.provider,
        environment: record.environment,
        status: record.status,
        configuredFields: [...record.configuredFields],
    };
}
