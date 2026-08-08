import { randomUUID } from "node:crypto";

import type { QueryExecutor } from "@/lib/server/database/postgres";

import { jsonValue, numberValue, stringValue } from "./repository-shared";

export type TaskBillingStatus = "reserved" | "settled" | "released" | "reversed";

export type TaskBillingReservationRecord = Readonly<{
    id: string;
    tenantId: string;
    generationTaskId: string;
    userWalletId: string;
    powerAccountId: string;
    saleReserved: number;
    costReserved: number;
    saleSettled: number;
    costSettled: number;
    status: TaskBillingStatus;
    idempotencyKey: string;
    snapshot: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}>;

export type CreateTaskBillingReservationInput = Omit<TaskBillingReservationRecord, "createdAt" | "updatedAt">;

export type UpdateTaskBillingReservationInput = Readonly<{
    tenantId: string;
    generationTaskId: string;
    patch: Partial<Pick<TaskBillingReservationRecord, "status" | "saleSettled" | "costSettled">>;
}>;

export interface TaskBillingRepositoryPort {
    getByTask(tenantId: string, generationTaskId: string, forUpdate?: boolean): Promise<TaskBillingReservationRecord | null>;
    getByIdempotencyKey(tenantId: string, idempotencyKey: string, forUpdate?: boolean): Promise<TaskBillingReservationRecord | null>;
    create(input: CreateTaskBillingReservationInput): Promise<TaskBillingReservationRecord>;
    update(input: UpdateTaskBillingReservationInput): Promise<TaskBillingReservationRecord>;
}

export class TaskBillingRepository implements TaskBillingRepositoryPort {
    constructor(private readonly db: QueryExecutor) {}

    async getByTask(tenantId: string, generationTaskId: string, forUpdate = false) {
        const result = await this.db.query(
            `SELECT * FROM task_billing_reservations
             WHERE tenant_id = $1 AND generation_task_id = $2
             ${forUpdate ? "FOR UPDATE" : ""}`,
            [tenantId, generationTaskId],
        );
        return result.rows[0] ? mapReservation(result.rows[0]) : null;
    }

    async getByIdempotencyKey(tenantId: string, idempotencyKey: string, forUpdate = false) {
        const result = await this.db.query(
            `SELECT * FROM task_billing_reservations
             WHERE tenant_id = $1 AND idempotency_key = $2
             ${forUpdate ? "FOR UPDATE" : ""}`,
            [tenantId, idempotencyKey],
        );
        return result.rows[0] ? mapReservation(result.rows[0]) : null;
    }

    async create(input: CreateTaskBillingReservationInput) {
        const result = await this.db.query(
            `INSERT INTO task_billing_reservations (
                id, tenant_id, generation_task_id, user_wallet_id, power_account_id,
                sale_reserved, cost_reserved, sale_settled, cost_settled, status,
                idempotency_key, snapshot_json, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $13)
             ON CONFLICT DO NOTHING
             RETURNING *`,
            [
                input.id || randomUUID(),
                input.tenantId,
                input.generationTaskId,
                input.userWalletId,
                input.powerAccountId,
                input.saleReserved,
                input.costReserved,
                input.saleSettled,
                input.costSettled,
                input.status,
                input.idempotencyKey,
                JSON.stringify(input.snapshot),
                Date.now(),
            ],
        );
        if (result.rows[0]) return mapReservation(result.rows[0]);
        const replay = await this.getByTask(input.tenantId, input.generationTaskId, true) || (await this.getByIdempotencyKey(input.tenantId, input.idempotencyKey, true));
        if (!replay) throw new Error("Task billing reservation insert conflicted without an idempotent result");
        return replay;
    }

    async update(input: UpdateTaskBillingReservationInput) {
        const status = input.patch.status;
        const saleSettled = input.patch.saleSettled;
        const costSettled = input.patch.costSettled;
        const result = await this.db.query(
            `UPDATE task_billing_reservations
             SET status = COALESCE($1, status),
                 sale_settled = COALESCE($2, sale_settled),
                 cost_settled = COALESCE($3, cost_settled),
                 updated_at = $6
             WHERE tenant_id = $4 AND generation_task_id = $5
             RETURNING *`,
            [status || null, saleSettled ?? null, costSettled ?? null, input.tenantId, input.generationTaskId, Date.now()],
        );
        if (!result.rows[0]) throw new Error("Task billing reservation was not found");
        return mapReservation(result.rows[0]);
    }
}

function mapReservation(row: Record<string, unknown>): TaskBillingReservationRecord {
    const status = stringValue(row.status);
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        generationTaskId: stringValue(row.generation_task_id),
        userWalletId: stringValue(row.user_wallet_id),
        powerAccountId: stringValue(row.power_account_id),
        saleReserved: numberValue(row.sale_reserved),
        costReserved: numberValue(row.cost_reserved),
        saleSettled: numberValue(row.sale_settled),
        costSettled: numberValue(row.cost_settled),
        status: status === "settled" || status === "released" || status === "reversed" ? status : "reserved",
        idempotencyKey: stringValue(row.idempotency_key),
        snapshot: jsonValue(row.snapshot_json) as Record<string, unknown>,
        createdAt: numberValue(row.created_at),
        updatedAt: numberValue(row.updated_at),
    };
}
