import { randomUUID } from "node:crypto";

import type { QueryExecutor } from "@/lib/server/database/postgres";

import { jsonValue, numberValue, optionalString, stringValue } from "./repository-shared";

export type TenantLedgerErrorCode =
    | "ACCOUNT_NOT_FOUND"
    | "INSUFFICIENT_BALANCE"
    | "INSUFFICIENT_RESERVED_BALANCE"
    | "INVALID_MUTATION"
    | "ORIGINAL_ENTRY_NOT_FOUND"
    | "ALREADY_REVERSED"
    | "INVALID_REVERSAL";

export class TenantLedgerError extends Error {
    constructor(
        message: string,
        readonly code: TenantLedgerErrorCode,
    ) {
        super(message);
        this.name = "TenantLedgerError";
    }
}

export type TenantAccountRecord = Readonly<{
    id: string;
    tenantId: string;
    userId?: string;
    currency?: string;
    unit?: string;
    availableAmount: number;
    reservedAmount: number;
    version: number;
    createdAt: number;
    updatedAt: number;
}>;

export type TenantLedgerEntryRecord = Readonly<{
    id: string;
    tenantId: string;
    accountId: string;
    amount: number;
    direction: "debit" | "credit";
    entryType: "reserve" | "settle" | "release" | "reverse";
    referenceType: string;
    referenceId: string;
    idempotencyKey: string;
    reversalOfId?: string;
    metadata: Record<string, unknown>;
    createdAt: number;
}>;

export type AccountMutation = Readonly<{
    tenantId: string;
    accountId: string;
    amount: number;
    referenceType: string;
    referenceId: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
}>;

export type LedgerMutationResult = Readonly<{
    account: TenantAccountRecord;
    entry: TenantLedgerEntryRecord;
    applied: boolean;
}>;

export interface ReservableAccountRepository {
    reserve(input: AccountMutation): Promise<LedgerMutationResult>;
    settle(input: AccountMutation & { actualAmount: number }): Promise<LedgerMutationResult>;
    release(input: AccountMutation): Promise<LedgerMutationResult>;
    reverse(input: AccountMutation & { originalEntryId: string }): Promise<LedgerMutationResult>;
}

export type TenantLedgerTransactionRunner = <T>(handler: (executor: QueryExecutor) => Promise<T>) => Promise<T>;

type TenantLedgerRepositoryConfig = Readonly<{
    accountTable: "tenant_user_wallets" | "tenant_power_accounts" | "tenant_settlement_accounts";
    ledgerTable: "tenant_user_wallet_ledger_entries" | "tenant_power_ledger_entries" | "tenant_settlement_ledger_entries";
}>;

type EnsureAccountInput = Readonly<{
    tenantId: string;
    identityWhere: string;
    identityValues: unknown[];
    insertColumns: string[];
    insertValues: unknown[];
    now?: number;
}>;

type MutationKind = "reserve" | "settle" | "release" | "reverse";

export class TenantLedgerRepository implements ReservableAccountRepository {
    private readonly transaction: TenantLedgerTransactionRunner;

    constructor(
        private readonly db: QueryExecutor,
        private readonly config: TenantLedgerRepositoryConfig,
        transaction?: TenantLedgerTransactionRunner,
    ) {
        this.transaction = transaction || ((handler) => handler(this.db));
    }

    async reserve(input: AccountMutation) {
        return this.mutate("reserve", input);
    }

    async settle(input: AccountMutation & { actualAmount: number }) {
        return this.mutate("settle", input);
    }

    async release(input: AccountMutation) {
        return this.mutate("release", input);
    }

    async reverse(input: AccountMutation & { originalEntryId: string }) {
        return this.mutate("reverse", input);
    }

    protected async ensureAccount(input: EnsureAccountInput) {
        const now = input.now ?? Date.now();
        return this.transaction(async (executor) => {
            const existing = await executor.query(
                `SELECT * FROM ${this.config.accountTable}
                 WHERE tenant_id = $1 AND ${input.identityWhere}
                 FOR UPDATE`,
                [input.tenantId, ...input.identityValues],
            );
            if (existing.rows[0]) return mapAccount(existing.rows[0]);

            const placeholders = Array.from({ length: 2 + input.insertValues.length }, (_, index) => `$${index + 1}`);
            const inserted = await executor.query(
                `INSERT INTO ${this.config.accountTable}
                    (id, tenant_id, ${input.insertColumns.join(", ")}, available_amount, reserved_amount, version, created_at, updated_at)
                 VALUES (${placeholders.join(", ")}, 0, 0, 0, $${placeholders.length + 1}, $${placeholders.length + 1})
                 ON CONFLICT DO NOTHING
                 RETURNING *`,
                [randomUUID(), input.tenantId, ...input.insertValues, now],
            );
            if (inserted.rows[0]) return mapAccount(inserted.rows[0]);

            const replay = await executor.query(
                `SELECT * FROM ${this.config.accountTable}
                 WHERE tenant_id = $1 AND ${input.identityWhere}
                 FOR UPDATE`,
                [input.tenantId, ...input.identityValues],
            );
            if (!replay.rows[0]) throw new TenantLedgerError("Account creation did not return an account", "ACCOUNT_NOT_FOUND");
            return mapAccount(replay.rows[0]);
        });
    }

    private async mutate(kind: MutationKind, input: AccountMutation | (AccountMutation & { actualAmount: number }) | (AccountMutation & { originalEntryId: string })) {
        validateMutation(kind, input);
        return this.transaction(async (executor) => {
            const accountResult = await executor.query(
                `SELECT * FROM ${this.config.accountTable}
                 WHERE id = $1 AND tenant_id = $2
                 FOR UPDATE`,
                [input.accountId, input.tenantId],
            );
            const accountRow = accountResult.rows[0];
            if (!accountRow) throw new TenantLedgerError("Tenant account was not found", "ACCOUNT_NOT_FOUND");
            const account = mapAccount(accountRow);

            const existing = await this.getEntryByIdempotencyKey(executor, input.accountId, input.idempotencyKey);
            if (existing) return { account, entry: existing, applied: false };

            let availableAmount = account.availableAmount;
            let reservedAmount = account.reservedAmount;
            let entryAmount = input.amount;
            let direction: TenantLedgerEntryRecord["direction"] = "debit";
            let reversalOfId: string | undefined;
            let metadata = { ...(input.metadata || {}) };

            if (kind === "reserve") {
                if (availableAmount < input.amount) throw new TenantLedgerError("Available balance is insufficient", "INSUFFICIENT_BALANCE");
                availableAmount -= input.amount;
                reservedAmount += input.amount;
            } else if (kind === "release") {
                if (reservedAmount < input.amount) throw new TenantLedgerError("Reserved balance is insufficient", "INSUFFICIENT_RESERVED_BALANCE");
                availableAmount += input.amount;
                reservedAmount -= input.amount;
                direction = "credit";
            } else if (kind === "settle") {
                const actualAmount = (input as AccountMutation & { actualAmount: number }).actualAmount;
                if (reservedAmount < input.amount) throw new TenantLedgerError("Reserved balance is insufficient", "INSUFFICIENT_RESERVED_BALANCE");
                reservedAmount -= input.amount;
                availableAmount += input.amount - actualAmount;
                entryAmount = actualAmount > 0 ? actualAmount : input.amount;
                direction = actualAmount > 0 ? "debit" : "credit";
                metadata = {
                    ...metadata,
                    reservedAmount: input.amount,
                    actualAmount,
                    releasedAmount: input.amount - actualAmount,
                };
            } else {
                const originalEntryId = (input as AccountMutation & { originalEntryId: string }).originalEntryId;
                const originalResult = await executor.query(
                    `SELECT * FROM ${this.config.ledgerTable}
                     WHERE id = $1 AND account_id = $2 AND tenant_id = $3
                     FOR UPDATE`,
                    [originalEntryId, input.accountId, input.tenantId],
                );
                const originalRow = originalResult.rows[0];
                if (!originalRow) throw new TenantLedgerError("Original ledger entry was not found", "ORIGINAL_ENTRY_NOT_FOUND");
                const original = mapEntry(originalRow);
                if (original.entryType === "reverse") throw new TenantLedgerError("A reversal entry cannot be reversed", "INVALID_REVERSAL");

                const reversedResult = await executor.query(
                    `SELECT * FROM ${this.config.ledgerTable}
                     WHERE reversal_of_id = $1 AND account_id = $2 AND tenant_id = $3
                     LIMIT 1`,
                    [originalEntryId, input.accountId, input.tenantId],
                );
                if (reversedResult.rows[0]) throw new TenantLedgerError("Ledger entry has already been reversed", "ALREADY_REVERSED");

                const reversal = calculateReversal(original, account);
                availableAmount = reversal.availableAmount;
                reservedAmount = reversal.reservedAmount;
                entryAmount = reversal.amount;
                direction = reversal.direction;
                reversalOfId = original.id;
                metadata = { ...metadata, originalEntryType: original.entryType };
            }

            const now = Date.now();
            const entryId = randomUUID();
            const insertResult = await executor.query(
                `INSERT INTO ${this.config.ledgerTable} (
                    id, tenant_id, account_id, entry_type, amount, direction, reference_type,
                    reference_id, idempotency_key, reversal_of_id, metadata_json, created_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (account_id, idempotency_key) DO NOTHING
                 RETURNING *`,
                [entryId, input.tenantId, input.accountId, kind, entryAmount, direction, input.referenceType, input.referenceId, input.idempotencyKey, reversalOfId || null, JSON.stringify(metadata), now],
            );
            if (!insertResult.rows[0]) {
                const replay = await this.getEntryByIdempotencyKey(executor, input.accountId, input.idempotencyKey);
                if (replay) return { account, entry: replay, applied: false };
                throw new TenantLedgerError("Ledger mutation conflicted without an idempotent result", "INVALID_MUTATION");
            }

            const updatedResult = await executor.query(
                `UPDATE ${this.config.accountTable}
                 SET available_amount = $1, reserved_amount = $2, version = $3, updated_at = $4
                 WHERE id = $5 AND tenant_id = $6
                 RETURNING *`,
                [availableAmount, reservedAmount, account.version + 1, now, input.accountId, input.tenantId],
            );
            if (!updatedResult.rows[0]) throw new TenantLedgerError("Tenant account projection was not updated", "ACCOUNT_NOT_FOUND");
            return {
                account: mapAccount(updatedResult.rows[0]),
                entry: mapEntry(insertResult.rows[0]),
                applied: true,
            };
        });
    }

    private async getEntryByIdempotencyKey(executor: QueryExecutor, accountId: string, idempotencyKey: string) {
        const result = await executor.query(
            `SELECT * FROM ${this.config.ledgerTable}
             WHERE account_id = $1 AND idempotency_key = $2`,
            [accountId, idempotencyKey],
        );
        return result.rows[0] ? mapEntry(result.rows[0]) : null;
    }
}

function validateMutation(kind: MutationKind, input: AccountMutation | (AccountMutation & { actualAmount: number }) | (AccountMutation & { originalEntryId: string })) {
    if (!input.tenantId.trim() || !input.accountId.trim() || !input.referenceType.trim() || !input.referenceId.trim() || !input.idempotencyKey.trim()) {
        throw new TenantLedgerError("Tenant ledger mutation identifiers are required", "INVALID_MUTATION");
    }
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
        throw new TenantLedgerError("Tenant ledger amount must be a positive safe integer", "INVALID_MUTATION");
    }
    if (kind === "settle") {
        const actualAmount = (input as AccountMutation & { actualAmount: number }).actualAmount;
        if (!Number.isSafeInteger(actualAmount) || actualAmount < 0 || actualAmount > input.amount) {
            throw new TenantLedgerError("Actual amount must be between zero and the reserved amount", "INVALID_MUTATION");
        }
    }
    if (kind === "reverse" && !(input as AccountMutation & { originalEntryId: string }).originalEntryId.trim()) {
        throw new TenantLedgerError("Original ledger entry id is required", "INVALID_MUTATION");
    }
}

function calculateReversal(original: TenantLedgerEntryRecord, account: TenantAccountRecord) {
    if (original.entryType === "reserve") {
        if (account.reservedAmount < original.amount) throw new TenantLedgerError("Reserved balance is insufficient for reversal", "INSUFFICIENT_RESERVED_BALANCE");
        return {
            amount: original.amount,
            direction: "credit" as const,
            availableAmount: account.availableAmount + original.amount,
            reservedAmount: account.reservedAmount - original.amount,
        };
    }
    if (original.entryType === "release") {
        if (account.availableAmount < original.amount) throw new TenantLedgerError("Available balance is insufficient for reversal", "INSUFFICIENT_BALANCE");
        return {
            amount: original.amount,
            direction: "debit" as const,
            availableAmount: account.availableAmount - original.amount,
            reservedAmount: account.reservedAmount + original.amount,
        };
    }
    const actualAmount = numberValue(original.metadata.actualAmount) || original.amount;
    return {
        amount: actualAmount,
        direction: "credit" as const,
        availableAmount: account.availableAmount + actualAmount,
        reservedAmount: account.reservedAmount,
    };
}

function mapAccount(row: Record<string, unknown>): TenantAccountRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        userId: optionalString(row.user_id),
        currency: optionalString(row.currency),
        unit: optionalString(row.unit),
        availableAmount: numberValue(row.available_amount),
        reservedAmount: numberValue(row.reserved_amount),
        version: numberValue(row.version),
        createdAt: numberValue(row.created_at),
        updatedAt: numberValue(row.updated_at),
    };
}

function mapEntry(row: Record<string, unknown>): TenantLedgerEntryRecord {
    const direction = stringValue(row.direction);
    const entryType = stringValue(row.entry_type);
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        accountId: stringValue(row.account_id),
        amount: numberValue(row.amount),
        direction: direction === "credit" ? "credit" : "debit",
        entryType: entryType === "settle" || entryType === "release" || entryType === "reverse" ? entryType : "reserve",
        referenceType: stringValue(row.reference_type),
        referenceId: stringValue(row.reference_id),
        idempotencyKey: stringValue(row.idempotency_key),
        reversalOfId: optionalString(row.reversal_of_id),
        metadata: jsonValue(row.metadata_json) as Record<string, unknown>,
        createdAt: numberValue(row.created_at),
    };
}
