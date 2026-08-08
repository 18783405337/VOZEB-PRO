import { describe, expect, it } from "vitest";

import { TenantLedgerError, type LedgerMutationResult, type ReservableAccountRepository, type TenantAccountRecord, type TenantLedgerEntryRecord } from "@/lib/server/database/tenant-ledger-repository";
import type { TaskBillingReservationRecord, TaskBillingRepositoryPort } from "@/lib/server/database/task-billing-repository";
import { TaskBillingServiceError, TaskBillingServiceImpl, type TaskBillingPorts, type ReserveTaskBillingInput } from "./task-billing-service";

type FakeAccount = { -readonly [K in keyof TenantAccountRecord]: TenantAccountRecord[K] } & { entries: TenantLedgerEntryRecord[] };

function account(overrides: Partial<FakeAccount> = {}): FakeAccount {
    return {
        id: "wallet-a",
        tenantId: "tenant-a",
        userId: "user-a",
        currency: "CNY",
        availableAmount: 100,
        reservedAmount: 0,
        version: 0,
        createdAt: 1,
        updatedAt: 1,
        entries: [],
        ...overrides,
    };
}

function billingInput(overrides: Partial<ReserveTaskBillingInput> = {}): ReserveTaskBillingInput {
    return {
        tenantId: "tenant-a",
        generationTaskId: "task-a",
        userId: "user-a",
        walletAccountId: "wallet-a",
        powerAccountId: "power-a",
        saleAmount: 20,
        costAmount: 10,
        idempotencyKey: "reserve-task-a",
        snapshot: {
            tenantId: "tenant-a",
            generationTaskId: "task-a",
            userId: "user-a",
            appKey: "image-basic",
            appVersion: "1.0.0",
            saleAmount: 20,
            costAmount: 10,
        },
        ...overrides,
    };
}

function makeLedgerPort(initial: FakeAccount): ReservableAccountRepository & { state: FakeAccount } {
    const state = structuredClone(initial);
    let entrySequence = 0;
    const mutate = (entryType: TenantLedgerEntryRecord["entryType"], input: { tenantId: string; accountId: string; amount: number; idempotencyKey: string; referenceType: string; referenceId: string; actualAmount?: number; originalEntryId?: string }): LedgerMutationResult => {
        if (state.tenantId !== input.tenantId || state.id !== input.accountId) throw new TenantLedgerError("Tenant account was not found", "ACCOUNT_NOT_FOUND");
        const existing = state.entries.find((entry) => entry.idempotencyKey === input.idempotencyKey);
        if (existing) return { account: state, entry: existing, applied: false };
        const actual = input.actualAmount;
        if (entryType === "reserve") {
            if (state.availableAmount < input.amount) throw new TenantLedgerError("Available balance is insufficient", "INSUFFICIENT_BALANCE");
            state.availableAmount -= input.amount;
            state.reservedAmount += input.amount;
        } else if (entryType === "settle") {
            if (state.reservedAmount < input.amount) throw new TenantLedgerError("Reserved balance is insufficient", "INSUFFICIENT_RESERVED_BALANCE");
            state.reservedAmount -= input.amount;
            state.availableAmount += input.amount - (actual || 0);
        } else if (entryType === "release") {
            if (state.reservedAmount < input.amount) throw new TenantLedgerError("Reserved balance is insufficient", "INSUFFICIENT_RESERVED_BALANCE");
            state.reservedAmount -= input.amount;
            state.availableAmount += input.amount;
        } else {
            const original = state.entries.find((entry) => entry.id === input.originalEntryId);
            if (!original) throw new TenantLedgerError("Original ledger entry was not found", "ORIGINAL_ENTRY_NOT_FOUND");
            if (state.entries.some((entry) => entry.reversalOfId === original.id)) throw new TenantLedgerError("Ledger entry has already been reversed", "ALREADY_REVERSED");
            state.availableAmount += original.amount;
        }
        state.version += 1;
        const entry: TenantLedgerEntryRecord = {
            id: `entry-${++entrySequence}`,
            tenantId: state.tenantId,
            accountId: state.id,
            amount: entryType === "settle" && actual === 0 ? input.amount : actual ?? input.amount,
            direction: entryType === "release" || entryType === "reverse" || (entryType === "settle" && actual === 0) ? "credit" : "debit",
            entryType,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            idempotencyKey: input.idempotencyKey,
            reversalOfId: input.originalEntryId,
            metadata: { actualAmount: actual },
            createdAt: Date.now(),
        };
        state.entries.push(entry);
        return { account: state, entry, applied: true };
    };
    return {
        state,
        reserve: async (input) => mutate("reserve", input),
        settle: async (input) => mutate("settle", input),
        release: async (input) => mutate("release", input),
        reverse: async (input) => mutate("reverse", input),
        getEntryByIdempotencyKey: async (_tenantId, _accountId, idempotencyKey) => state.entries.find((entry) => entry.idempotencyKey === idempotencyKey) || null,
    };
}

function makeRepository(): TaskBillingRepositoryPort & { rows: TaskBillingReservationRecord[] } {
    const rows: TaskBillingReservationRecord[] = [];
    return {
        rows,
        getByTask: async (tenantId, generationTaskId) => rows.find((row) => row.tenantId === tenantId && row.generationTaskId === generationTaskId) || null,
        getByIdempotencyKey: async (tenantId, idempotencyKey) => rows.find((row) => row.tenantId === tenantId && row.idempotencyKey === idempotencyKey) || null,
        create: async (input) => {
            const row = { ...input, id: input.id, createdAt: 1, updatedAt: 1 };
            rows.push(row);
            return row;
        },
        update: async (input) => {
            const row = rows.find((item) => item.tenantId === input.tenantId && item.generationTaskId === input.generationTaskId);
            if (!row) throw new Error("reservation missing");
            Object.assign(row, input.patch, { updatedAt: 2 });
            return row;
        },
    };
}

function makeService(options: { wallet?: FakeAccount; power?: FakeAccount } = {}) {
    const wallet = makeLedgerPort(options.wallet || account());
    const power = makeLedgerPort(options.power || account({ id: "power-a", userId: undefined, currency: undefined, unit: "GPU_SECOND", availableAmount: 50 }));
    const reservations = makeRepository();
    const ports: TaskBillingPorts = { reservations, wallet, power };
    const transaction = async <T>(handler: (ports: TaskBillingPorts) => Promise<T>) => {
        const walletSnapshot = structuredClone(wallet.state);
        const powerSnapshot = structuredClone(power.state);
        const rowsSnapshot = structuredClone(reservations.rows);
        try {
            return await handler(ports);
        } catch (error) {
            Object.assign(wallet.state, walletSnapshot);
            Object.assign(power.state, powerSnapshot);
            reservations.rows.splice(0, reservations.rows.length, ...rowsSnapshot);
            throw error;
        }
    };
    return { service: new TaskBillingServiceImpl(ports, transaction), wallet, power, reservations };
}

describe("task billing service", () => {
    it("reserves both sale and power cost atomically and replays the reservation", async () => {
        const { service, wallet, power, reservations } = makeService();

        const first = await service.reserve(billingInput());
        const replay = await service.reserve(billingInput());

        expect(first).toMatchObject({ status: "reserved", saleReserved: 20, costReserved: 10 });
        expect(replay).toEqual(first);
        expect(wallet.state).toMatchObject({ availableAmount: 80, reservedAmount: 20 });
        expect(power.state).toMatchObject({ availableAmount: 40, reservedAmount: 10 });
        expect(reservations.rows).toHaveLength(1);
    });

    it("rejects a reservation replay when the idempotency key is reused with different amounts", async () => {
        const { service } = makeService();
        await service.reserve(billingInput());

        await expect(service.reserve(billingInput({ saleAmount: 21, snapshot: { ...billingInput().snapshot, saleAmount: 21 } }))).rejects.toMatchObject({
            code: "RESERVATION_CONFLICT",
        });
    });

    it("rolls back the wallet reservation when the power side cannot reserve", async () => {
        const { service, wallet, power, reservations } = makeService({ power: account({ id: "power-a", userId: undefined, currency: undefined, unit: "GPU_SECOND", availableAmount: 5 }) });

        await expect(service.reserve(billingInput())).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });

        expect(wallet.state).toMatchObject({ availableAmount: 100, reservedAmount: 0 });
        expect(power.state).toMatchObject({ availableAmount: 5, reservedAmount: 0 });
        expect(reservations.rows).toHaveLength(0);
    });

    it("settles actual usage and releases the reserved remainder on both sides", async () => {
        const { service, wallet, power } = makeService();
        await service.reserve(billingInput());

        const settled = await service.settle({
            tenantId: "tenant-a",
            generationTaskId: "task-a",
            actualSaleAmount: 15,
            actualCostAmount: 6,
            idempotencyKey: "settle-task-a",
        });

        expect(settled).toMatchObject({ status: "settled", saleReserved: 20, costReserved: 10, saleSettled: 15, costSettled: 6 });
        expect(wallet.state).toMatchObject({ availableAmount: 85, reservedAmount: 0 });
        expect(power.state).toMatchObject({ availableAmount: 44, reservedAmount: 0 });

        await expect(
            service.settle({
                tenantId: "tenant-a",
                generationTaskId: "task-a",
                actualSaleAmount: 14,
                actualCostAmount: 6,
                idempotencyKey: "settle-task-a-replay",
            }),
        ).rejects.toMatchObject({ code: "RESERVATION_CONFLICT" });
    });

    it("releases a pending reservation and reverses a settled reservation", async () => {
        const { service, wallet, power } = makeService();
        await service.reserve(billingInput());
        const released = await service.release({ tenantId: "tenant-a", generationTaskId: "task-a", idempotencyKey: "release-task-a" });
        expect(released.status).toBe("released");
        expect(wallet.state).toMatchObject({ availableAmount: 100, reservedAmount: 0 });
        expect(power.state).toMatchObject({ availableAmount: 50, reservedAmount: 0 });

        await service.reserve({ ...billingInput(), generationTaskId: "task-b", idempotencyKey: "reserve-task-b", snapshot: { ...billingInput().snapshot, generationTaskId: "task-b" } });
        await service.settle({ tenantId: "tenant-a", generationTaskId: "task-b", actualSaleAmount: 15, actualCostAmount: 6, idempotencyKey: "settle-task-b" });
        const reversed = await service.reverse({ tenantId: "tenant-a", generationTaskId: "task-b", idempotencyKey: "reverse-task-b" });

        expect(reversed.status).toBe("reversed");
        expect(wallet.state).toMatchObject({ availableAmount: 100, reservedAmount: 0 });
        expect(power.state).toMatchObject({ availableAmount: 50, reservedAmount: 0 });
    });

    it("rejects invalid state transitions and cross-tenant snapshots", async () => {
        const { service } = makeService();
        await service.reserve(billingInput());
        await service.settle({ tenantId: "tenant-a", generationTaskId: "task-a", actualSaleAmount: 20, actualCostAmount: 10, idempotencyKey: "settle-task-a" });

        await expect(service.release({ tenantId: "tenant-a", generationTaskId: "task-a", idempotencyKey: "release-task-a" })).rejects.toMatchObject({ code: "INVALID_STATE" });
        await expect(service.reserve(billingInput({ snapshot: { ...billingInput().snapshot, tenantId: "tenant-b" } }))).rejects.toMatchObject({ code: "TENANT_MISMATCH" });
        await expect(service.settle({ tenantId: "tenant-b", generationTaskId: "task-a", actualSaleAmount: 1, actualCostAmount: 1, idempotencyKey: "settle-task-a-2" })).rejects.toMatchObject({ code: "RESERVATION_NOT_FOUND" });
        expect(new TaskBillingServiceError("x", "INVALID_STATE")).toBeInstanceOf(Error);
    });
});
