import { randomUUID } from "node:crypto";

import { createPostgresRepositories, withPostgresTransaction } from "@/lib/server/database";
import type { ReservableAccountRepository } from "@/lib/server/database/tenant-ledger-repository";
import type {
    CreateTaskBillingReservationInput,
    TaskBillingRepositoryPort,
    TaskBillingReservationRecord,
} from "@/lib/server/database/task-billing-repository";

export type ReserveTaskBillingInput = Readonly<{
    tenantId: string;
    generationTaskId: string;
    userId: string;
    walletAccountId: string;
    powerAccountId: string;
    saleAmount: number;
    costAmount: number;
    idempotencyKey: string;
    snapshot: Record<string, unknown>;
}>;

export type TaskBillingCommand = Readonly<{
    tenantId: string;
    generationTaskId: string;
    idempotencyKey: string;
}>;

export type SettleTaskBillingInput = TaskBillingCommand & Readonly<{
    actualSaleAmount: number;
    actualCostAmount: number;
}>;

export type TaskBillingPorts = Readonly<{
    reservations: TaskBillingRepositoryPort;
    wallet: ReservableAccountRepository;
    power: ReservableAccountRepository;
}>;

export type TaskBillingTransactionRunner = <T>(handler: (ports: TaskBillingPorts) => Promise<T>) => Promise<T>;

export type TaskBillingServiceErrorCode =
    | "INVALID_INPUT"
    | "TENANT_MISMATCH"
    | "TASK_MISMATCH"
    | "RESERVATION_NOT_FOUND"
    | "RESERVATION_CONFLICT"
    | "INVALID_STATE";

export class TaskBillingServiceError extends Error {
    constructor(
        message: string,
        readonly code: TaskBillingServiceErrorCode,
    ) {
        super(message);
        this.name = "TaskBillingServiceError";
    }
}

export interface TaskBillingService {
    reserve(input: ReserveTaskBillingInput): Promise<TaskBillingReservationRecord>;
    settle(input: SettleTaskBillingInput): Promise<TaskBillingReservationRecord>;
    release(input: TaskBillingCommand): Promise<TaskBillingReservationRecord>;
    reverse(input: TaskBillingCommand): Promise<TaskBillingReservationRecord>;
}

export class TaskBillingServiceImpl implements TaskBillingService {
    constructor(
        private readonly ports: TaskBillingPorts,
        private readonly transaction: TaskBillingTransactionRunner = (handler) => handler(this.ports),
    ) {}

    async reserve(input: ReserveTaskBillingInput) {
        validateReserveInput(input);
        return this.transaction(async (ports) => {
            const existing = await ports.reservations.getByTask(input.tenantId, input.generationTaskId, true);
            if (existing) {
                if (existing.idempotencyKey !== input.idempotencyKey || !sameReservationInput(existing, input)) {
                    throw new TaskBillingServiceError("Generation task already has a billing reservation", "RESERVATION_CONFLICT");
                }
                return existing;
            }
            const idempotencyReplay = await ports.reservations.getByIdempotencyKey(input.tenantId, input.idempotencyKey, true);
            if (idempotencyReplay) {
                if (!sameReservationInput(idempotencyReplay, input)) throw new TaskBillingServiceError("Task billing idempotency key was reused with different input", "RESERVATION_CONFLICT");
                return idempotencyReplay;
            }

            await reserveAccount(ports.wallet, {
                tenantId: input.tenantId,
                accountId: input.walletAccountId,
                amount: input.saleAmount,
                referenceType: "generation_task",
                referenceId: input.generationTaskId,
                idempotencyKey: operationKey(input.generationTaskId, "reserve", "sale"),
                metadata: { side: "sale", userId: input.userId },
            });
            await reserveAccount(ports.power, {
                tenantId: input.tenantId,
                accountId: input.powerAccountId,
                amount: input.costAmount,
                referenceType: "generation_task",
                referenceId: input.generationTaskId,
                idempotencyKey: operationKey(input.generationTaskId, "reserve", "cost"),
                metadata: { side: "cost", userId: input.userId },
            });

            const reservation: CreateTaskBillingReservationInput = {
                id: randomUUID(),
                tenantId: input.tenantId,
                generationTaskId: input.generationTaskId,
                userWalletId: input.walletAccountId,
                powerAccountId: input.powerAccountId,
                saleReserved: input.saleAmount,
                costReserved: input.costAmount,
                saleSettled: 0,
                costSettled: 0,
                status: "reserved",
                idempotencyKey: input.idempotencyKey,
                snapshot: input.snapshot,
            };
            return ports.reservations.create(reservation);
        });
    }

    async settle(input: SettleTaskBillingInput) {
        validateSettleInput(input);
        return this.transaction(async (ports) => {
            const reservation = await requireReservation(ports.reservations, input.tenantId, input.generationTaskId);
            if (reservation.status === "settled" || reservation.status === "reversed") {
                if (reservation.saleSettled !== input.actualSaleAmount || reservation.costSettled !== input.actualCostAmount) {
                    throw new TaskBillingServiceError("Task billing settlement replay does not match the original amounts", "RESERVATION_CONFLICT");
                }
                return reservation;
            }
            if (reservation.status !== "reserved") throw new TaskBillingServiceError("Only reserved task billing can be settled", "INVALID_STATE");

            await settleAccount(ports.wallet, reservation, input.actualSaleAmount, "sale");
            await settleAccount(ports.power, reservation, input.actualCostAmount, "cost");
            return ports.reservations.update({
                tenantId: input.tenantId,
                generationTaskId: input.generationTaskId,
                patch: { status: "settled", saleSettled: input.actualSaleAmount, costSettled: input.actualCostAmount },
            });
        });
    }

    async release(input: TaskBillingCommand) {
        validateCommand(input);
        return this.transaction(async (ports) => {
            const reservation = await requireReservation(ports.reservations, input.tenantId, input.generationTaskId);
            if (reservation.status === "released") return reservation;
            if (reservation.status !== "reserved") throw new TaskBillingServiceError("Only reserved task billing can be released", "INVALID_STATE");

            await releaseAccount(ports.wallet, reservation, "sale");
            await releaseAccount(ports.power, reservation, "cost");
            return ports.reservations.update({
                tenantId: input.tenantId,
                generationTaskId: input.generationTaskId,
                patch: { status: "released" },
            });
        });
    }

    async reverse(input: TaskBillingCommand) {
        validateCommand(input);
        return this.transaction(async (ports) => {
            const reservation = await requireReservation(ports.reservations, input.tenantId, input.generationTaskId);
            if (reservation.status === "reversed") return reservation;
            if (reservation.status !== "settled") throw new TaskBillingServiceError("Only settled task billing can be reversed", "INVALID_STATE");

            await reverseAccount(ports.wallet, reservation, "sale");
            await reverseAccount(ports.power, reservation, "cost");
            return ports.reservations.update({
                tenantId: input.tenantId,
                generationTaskId: input.generationTaskId,
                patch: { status: "reversed" },
            });
        });
    }
}

export function createPostgresTaskBillingService() {
    const repositories = createPostgresRepositories();
    const ports: TaskBillingPorts = {
        reservations: repositories.taskBilling,
        wallet: repositories.tenantWallet,
        power: repositories.tenantPower,
    };
    const transaction: TaskBillingTransactionRunner = (handler) =>
        withPostgresTransaction(async (client) => {
            const transactionRepositories = createPostgresRepositories(client);
            return handler({
                reservations: transactionRepositories.taskBilling,
                wallet: transactionRepositories.tenantWallet,
                power: transactionRepositories.tenantPower,
            });
        });
    return new TaskBillingServiceImpl(ports, transaction);
}

async function requireReservation(repository: TaskBillingRepositoryPort, tenantId: string, generationTaskId: string) {
    const reservation = await repository.getByTask(tenantId, generationTaskId, true);
    if (!reservation) throw new TaskBillingServiceError("Task billing reservation was not found", "RESERVATION_NOT_FOUND");
    if (reservation.tenantId !== tenantId) throw new TaskBillingServiceError("Task billing tenant does not match", "TENANT_MISMATCH");
    if (reservation.generationTaskId !== generationTaskId) throw new TaskBillingServiceError("Task billing task does not match", "TASK_MISMATCH");
    return reservation;
}

async function reserveAccount(repository: ReservableAccountRepository, input: Parameters<ReservableAccountRepository["reserve"]>[0]) {
    if (input.amount === 0) return;
    await repository.reserve(input);
}

async function settleAccount(repository: ReservableAccountRepository, reservation: TaskBillingReservationRecord, actualAmount: number, side: "sale" | "cost") {
    const reservedAmount = side === "sale" ? reservation.saleReserved : reservation.costReserved;
    if (reservedAmount === 0) return;
    await repository.settle({
        tenantId: reservation.tenantId,
        accountId: side === "sale" ? reservation.userWalletId : reservation.powerAccountId,
        amount: reservedAmount,
        actualAmount,
        referenceType: "generation_task",
        referenceId: reservation.generationTaskId,
        idempotencyKey: operationKey(reservation.generationTaskId, "settle", side),
        metadata: { side },
    });
}

async function releaseAccount(repository: ReservableAccountRepository, reservation: TaskBillingReservationRecord, side: "sale" | "cost") {
    const amount = side === "sale" ? reservation.saleReserved : reservation.costReserved;
    if (amount === 0) return;
    await repository.release({
        tenantId: reservation.tenantId,
        accountId: side === "sale" ? reservation.userWalletId : reservation.powerAccountId,
        amount,
        referenceType: "generation_task",
        referenceId: reservation.generationTaskId,
        idempotencyKey: operationKey(reservation.generationTaskId, "release", side),
        metadata: { side },
    });
}

async function reverseAccount(repository: ReservableAccountRepository, reservation: TaskBillingReservationRecord, side: "sale" | "cost") {
    const actualAmount = side === "sale" ? reservation.saleSettled : reservation.costSettled;
    if (actualAmount === 0) return;
    const accountId = side === "sale" ? reservation.userWalletId : reservation.powerAccountId;
    const original = await repository.getEntryByIdempotencyKey(reservation.tenantId, accountId, operationKey(reservation.generationTaskId, "settle", side));
    if (!original) throw new TaskBillingServiceError("Settled ledger entry was not found", "RESERVATION_NOT_FOUND");
    await repository.reverse({
        tenantId: reservation.tenantId,
        accountId,
        amount: original.amount,
        referenceType: "generation_task",
        referenceId: reservation.generationTaskId,
        idempotencyKey: operationKey(reservation.generationTaskId, "reverse", side),
        originalEntryId: original.id,
        metadata: { side },
    });
}

function operationKey(taskId: string, operation: string, side: "sale" | "cost") {
    return `task-billing:${taskId}:${operation}:${side}`;
}

function sameReservationInput(existing: TaskBillingReservationRecord, input: ReserveTaskBillingInput) {
    return (
        existing.generationTaskId === input.generationTaskId &&
        existing.userWalletId === input.walletAccountId &&
        existing.powerAccountId === input.powerAccountId &&
        existing.saleReserved === input.saleAmount &&
        existing.costReserved === input.costAmount &&
        JSON.stringify(existing.snapshot) === JSON.stringify(input.snapshot)
    );
}

function validateReserveInput(input: ReserveTaskBillingInput) {
    requiredText(input.tenantId, "tenantId");
    requiredText(input.generationTaskId, "generationTaskId");
    requiredText(input.userId, "userId");
    requiredText(input.walletAccountId, "walletAccountId");
    requiredText(input.powerAccountId, "powerAccountId");
    requiredText(input.idempotencyKey, "idempotencyKey");
    validateAmount(input.saleAmount, "saleAmount", true);
    validateAmount(input.costAmount, "costAmount", true);
    if (!input.snapshot || typeof input.snapshot !== "object" || Array.isArray(input.snapshot)) throw new TaskBillingServiceError("Task billing snapshot is required", "INVALID_INPUT");
    if (input.snapshot.tenantId !== input.tenantId) throw new TaskBillingServiceError("Task billing tenant does not match the snapshot", "TENANT_MISMATCH");
    if (input.snapshot.generationTaskId !== input.generationTaskId) throw new TaskBillingServiceError("Task billing task does not match the snapshot", "TASK_MISMATCH");
}

function validateSettleInput(input: SettleTaskBillingInput) {
    validateCommand(input);
    validateAmount(input.actualSaleAmount, "actualSaleAmount", true);
    validateAmount(input.actualCostAmount, "actualCostAmount", true);
}

function validateCommand(input: TaskBillingCommand) {
    requiredText(input.tenantId, "tenantId");
    requiredText(input.generationTaskId, "generationTaskId");
    requiredText(input.idempotencyKey, "idempotencyKey");
}

function requiredText(value: string, field: string) {
    if (typeof value !== "string" || !value.trim()) throw new TaskBillingServiceError(`${field} is required`, "INVALID_INPUT");
}

function validateAmount(value: number, field: string, allowZero: boolean) {
    if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)) throw new TaskBillingServiceError(`${field} must be a safe integer`, "INVALID_INPUT");
}
