import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "@/lib/server/database/postgres";
import { TenantLedgerError } from "@/lib/server/database/tenant-ledger-repository";
import { TenantPowerRepository } from "@/lib/server/database/tenant-power-repository";
import { TenantSettlementRepository } from "@/lib/server/database/tenant-settlement-repository";
import { TenantWalletRepository } from "@/lib/server/database/tenant-wallet-repository";

function queryResult(rows: Record<string, unknown>[] = []) {
    return { rows, rowCount: rows.length };
}

function accountRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "wallet-a",
        tenant_id: "tenant-a",
        user_id: "user-a",
        currency: "POINT",
        available_amount: 100,
        reserved_amount: 0,
        version: 0,
        created_at: 1,
        updated_at: 1,
        ...overrides,
    };
}

function ledgerRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "entry-a",
        tenant_id: "tenant-a",
        account_id: "wallet-a",
        amount: 40,
        direction: "debit",
        entry_type: "reserve",
        reference_type: "task",
        reference_id: "task-a",
        idempotency_key: "reserve-task-a",
        reversal_of_id: null,
        metadata_json: {},
        created_at: 2,
        ...overrides,
    };
}

function walletInput(overrides: Partial<Parameters<TenantWalletRepository["reserve"]>[0]> = {}) {
    return {
        tenantId: "tenant-a",
        accountId: "wallet-a",
        amount: 40,
        referenceType: "task",
        referenceId: "task-a",
        idempotencyKey: "reserve-task-a",
        ...overrides,
    };
}

describe("tenant ledger repositories", () => {
    it("serializes reservations with an account row lock and rejects an insufficient second reservation", async () => {
        const state = {
            account: accountRow(),
        };
        const query = vi.fn(async (text: string, values: unknown[] = []) => {
            if (text.includes("SELECT * FROM tenant_user_wallets") && text.includes("FOR UPDATE")) {
                return queryResult([state.account]);
            }
            if (text.includes("INSERT INTO tenant_user_wallet_ledger_entries")) {
                return queryResult([ledgerRow({ amount: values[4] })]);
            }
            if (text.includes("tenant_user_wallet_ledger_entries") && text.includes("idempotency_key")) {
                return queryResult([]);
            }
            if (text.includes("UPDATE tenant_user_wallets")) {
                state.account = accountRow({
                    available_amount: Number(values[0]),
                    reserved_amount: Number(values[1]),
                    version: Number(values[2]),
                });
                return queryResult([state.account]);
            }
            throw new Error(`Unexpected query: ${text}`);
        });
        let transactionTail = Promise.resolve();
        const transaction = async <T>(handler: (executor: QueryExecutor) => Promise<T>) => {
            const previous = transactionTail;
            let release!: () => void;
            transactionTail = new Promise<void>((resolve) => {
                release = resolve;
            });
            await previous;
            try {
                return await handler({ query } as unknown as QueryExecutor);
            } finally {
                release();
            }
        };
        const repository = new TenantWalletRepository({ query } as unknown as QueryExecutor, transaction);

        const transactionResults = await Promise.allSettled([
            repository.reserve(walletInput({ amount: 100 })),
            repository.reserve(walletInput({ amount: 1, idempotencyKey: "reserve-task-b", referenceId: "task-b" })),
        ]);

        expect(transactionResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(transactionResults.find((result) => result.status === "rejected")).toMatchObject({
            status: "rejected",
            reason: { code: "INSUFFICIENT_BALANCE" },
        });

        const lockQuery = query.mock.calls.find(([text]) => text.includes("SELECT * FROM tenant_user_wallets") && text.includes("FOR UPDATE"));
        expect(lockQuery?.[0]).toContain("tenant_id = $2");
    });

    it("returns the original ledger entry when an idempotency key is replayed", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce(queryResult([accountRow({ available_amount: 60, reserved_amount: 40, version: 1 })]))
            .mockResolvedValueOnce(queryResult([ledgerRow()]));
        const repository = new TenantPowerRepository({ query } as unknown as QueryExecutor);

        const result = await repository.reserve({
            tenantId: "tenant-a",
            accountId: "power-a",
            amount: 40,
            referenceType: "task",
            referenceId: "task-a",
            idempotencyKey: "reserve-task-a",
        });

        expect(result.applied).toBe(false);
        expect(result.entry.id).toBe("entry-a");
        expect(query).toHaveBeenCalledTimes(2);
    });

    it("does not allow one tenant to mutate another tenant account", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([]));
        const repository = new TenantSettlementRepository({ query } as unknown as QueryExecutor);

        await expect(
            repository.reserve({
                tenantId: "tenant-a",
                accountId: "settlement-b",
                amount: 10,
                referenceType: "task",
                referenceId: "task-a",
                idempotencyKey: "reserve-task-a",
            }),
        ).rejects.toMatchObject({
            code: "ACCOUNT_NOT_FOUND",
        });

        expect(query.mock.calls[0]?.[0]).toContain("tenant_id = $2");
        expect(query.mock.calls[0]?.[1]).toEqual(["settlement-b", "tenant-a"]);
    });

    it("creates a reversal linked to the original entry and rejects a second reversal", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce(queryResult([accountRow({ id: "power-a", tenant_id: "tenant-a", unit: "GPU_SECOND" })]))
            .mockResolvedValueOnce(queryResult([]))
            .mockResolvedValueOnce(queryResult([ledgerRow({ id: "settle-entry", account_id: "power-a", entry_type: "settle", amount: 40 })]))
            .mockResolvedValueOnce(queryResult([]))
            .mockResolvedValueOnce(queryResult([ledgerRow({ id: "reverse-entry", entry_type: "reverse", direction: "credit", reversal_of_id: "settle-entry" })]))
            .mockResolvedValueOnce(queryResult([accountRow({ id: "power-a", available_amount: 140, version: 1 })]))
            .mockResolvedValueOnce(queryResult([accountRow({ id: "power-a", available_amount: 140, version: 1 })]))
            .mockResolvedValueOnce(queryResult([]))
            .mockResolvedValueOnce(queryResult([ledgerRow({ id: "settle-entry", account_id: "power-a", entry_type: "settle", amount: 40 })]))
            .mockResolvedValueOnce(queryResult([{ reversed_amount: 40 }]));
        const repository = new TenantPowerRepository({ query } as unknown as QueryExecutor);
        const input = {
            tenantId: "tenant-a",
            accountId: "power-a",
            amount: 40,
            referenceType: "task",
            referenceId: "task-a",
            idempotencyKey: "reverse-task-a",
            originalEntryId: "settle-entry",
        };

        const result = await repository.reverse(input);

        expect(result.entry.reversalOfId).toBe("settle-entry");
        expect(query.mock.calls.some(([text, values]) => text.includes("reversal_of_id = $1") && values?.[0] === "settle-entry")).toBe(true);
        await expect(repository.reverse({ ...input, idempotencyKey: "reverse-task-a-2" })).rejects.toMatchObject({
            code: "ALREADY_REVERSED",
        });
        expect(new TenantLedgerError("x", "ALREADY_REVERSED")).toBeInstanceOf(Error);
    });

    it("partially reverses one credit entry until its full amount is consumed", async () => {
        const original = ledgerRow({
            id: "settlement-credit",
            account_id: "settlement-a",
            entry_type: "credit",
            direction: "credit",
            amount: 100,
        });
        const query = vi.fn()
            .mockResolvedValueOnce(queryResult([accountRow({ id: "settlement-a", currency: "CNY", available_amount: 100 })]))
            .mockResolvedValueOnce(queryResult([]))
            .mockResolvedValueOnce(queryResult([original]))
            .mockResolvedValueOnce(queryResult([{ reversed_amount: 0 }]))
            .mockResolvedValueOnce(
                queryResult([
                    ledgerRow({
                        id: "partial-reversal-one",
                        account_id: "settlement-a",
                        entry_type: "reverse",
                        direction: "debit",
                        amount: 40,
                        reversal_of_id: "settlement-credit",
                    }),
                ]),
            )
            .mockResolvedValueOnce(queryResult([accountRow({ id: "settlement-a", currency: "CNY", available_amount: 60, version: 1 })]))
            .mockResolvedValueOnce(queryResult([accountRow({ id: "settlement-a", currency: "CNY", available_amount: 60, version: 1 })]))
            .mockResolvedValueOnce(queryResult([]))
            .mockResolvedValueOnce(queryResult([original]))
            .mockResolvedValueOnce(queryResult([{ reversed_amount: 40 }]))
            .mockResolvedValueOnce(
                queryResult([
                    ledgerRow({
                        id: "partial-reversal-two",
                        account_id: "settlement-a",
                        entry_type: "reverse",
                        direction: "debit",
                        amount: 60,
                        reversal_of_id: "settlement-credit",
                    }),
                ]),
            )
            .mockResolvedValueOnce(queryResult([accountRow({ id: "settlement-a", currency: "CNY", available_amount: 0, version: 2 })]));
        const repository = new TenantSettlementRepository({ query } as unknown as QueryExecutor);
        const baseInput = {
            tenantId: "tenant-a",
            accountId: "settlement-a",
            referenceType: "billing-refund",
            originalEntryId: "settlement-credit",
        };

        const first = await repository.reverse({
            ...baseInput,
            amount: 40,
            referenceId: "refund-one",
            idempotencyKey: "refund-one",
        });
        const second = await repository.reverse({
            ...baseInput,
            amount: 60,
            referenceId: "refund-two",
            idempotencyKey: "refund-two",
        });

        expect(first).toMatchObject({ account: { availableAmount: 60 }, entry: { amount: 40 } });
        expect(second).toMatchObject({ account: { availableAmount: 0 }, entry: { amount: 60 } });
    });

    it("credits a settlement receivable and reverses the exact credit entry", async () => {
        const creditedAccount = accountRow({ id: "settlement-a", currency: "CNY", available_amount: 140, version: 1 });
        const creditEntry = ledgerRow({
            id: "settlement-credit",
            account_id: "settlement-a",
            entry_type: "credit",
            direction: "credit",
            amount: 40,
            idempotency_key: "billing-order:order-a:settlement-credit",
        });
        const reversedAccount = accountRow({ id: "settlement-a", currency: "CNY", available_amount: 100, version: 2 });
        const query = vi.fn()
            .mockResolvedValueOnce(queryResult([accountRow({ id: "settlement-a", currency: "CNY" })]))
            .mockResolvedValueOnce(queryResult([]))
            .mockResolvedValueOnce(queryResult([creditEntry]))
            .mockResolvedValueOnce(queryResult([creditedAccount]))
            .mockResolvedValueOnce(queryResult([creditedAccount]))
            .mockResolvedValueOnce(queryResult([]))
            .mockResolvedValueOnce(queryResult([creditEntry]))
            .mockResolvedValueOnce(queryResult([]))
            .mockResolvedValueOnce(
                queryResult([
                    ledgerRow({
                        id: "settlement-reversal",
                        account_id: "settlement-a",
                        entry_type: "reverse",
                        direction: "debit",
                        amount: 40,
                        reversal_of_id: "settlement-credit",
                        idempotency_key: "billing-refund:refund-a:settlement-reversal",
                    }),
                ]),
            )
            .mockResolvedValueOnce(queryResult([reversedAccount]));
        const repository = new TenantSettlementRepository({ query } as unknown as QueryExecutor);

        const credited = await repository.credit({
            tenantId: "tenant-a",
            accountId: "settlement-a",
            amount: 40,
            referenceType: "billing-order",
            referenceId: "order-a",
            idempotencyKey: "billing-order:order-a:settlement-credit",
        });
        const reversed = await repository.reverse({
            tenantId: "tenant-a",
            accountId: "settlement-a",
            amount: 40,
            referenceType: "billing-refund",
            referenceId: "refund-a",
            idempotencyKey: "billing-refund:refund-a:settlement-reversal",
            originalEntryId: credited.entry.id,
        });

        expect(credited.account.availableAmount).toBe(140);
        expect(credited.entry).toMatchObject({ entryType: "credit", direction: "credit" });
        expect(reversed.account.availableAmount).toBe(100);
        expect(reversed.entry).toMatchObject({ entryType: "reverse", direction: "debit", reversalOfId: "settlement-credit" });
    });

    it("creates a wallet account with a tenant-scoped unique identity", async () => {
        const query = vi.fn()
            .mockResolvedValueOnce(queryResult([]))
            .mockResolvedValueOnce(queryResult([accountRow({ id: "wallet-new", user_id: "user-b", currency: "CNY" })]));
        const repository = new TenantWalletRepository({ query } as unknown as QueryExecutor);

        const account = await repository.getOrCreateAccount({
            tenantId: "tenant-b",
            userId: "user-b",
            currency: "CNY",
            now: 123,
        });

        expect(account.id).toBe("wallet-new");
        expect(query.mock.calls[1]?.[0]).toContain("ON CONFLICT DO NOTHING");
        expect(query.mock.calls[1]?.[1]).toEqual(expect.arrayContaining(["tenant-b", "user-b", "CNY", 123]));
    });

    it("lists only accounts owned by the requested tenant", async () => {
        const query = vi.fn().mockResolvedValue(
            queryResult([
                accountRow({ id: "wallet-a", tenant_id: "tenant-a", updated_at: 20 }),
                accountRow({ id: "wallet-b", tenant_id: "tenant-a", updated_at: 10 }),
            ]),
        );
        const repository = new TenantWalletRepository({ query } as unknown as QueryExecutor);

        await expect(repository.listAccounts("tenant-a")).resolves.toHaveLength(2);

        expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE tenant_id = $1"), ["tenant-a"]);
        expect(query.mock.calls[0]?.[0]).toContain("ORDER BY updated_at DESC");
    });
});
