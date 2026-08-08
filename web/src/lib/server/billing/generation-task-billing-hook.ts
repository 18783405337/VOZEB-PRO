import { createPostgresRepositories, ensurePostgresSchema, isPostgresDatabaseEnabled, postgresQuery } from "@/lib/server/database";
import type { TaskBillingRepositoryPort, TaskBillingReservationRecord } from "@/lib/server/database/task-billing-repository";
import { createPostgresTaskBillingService, type TaskBillingService } from "./task-billing-service";
import { isAppCenterEnabled } from "@/lib/server/tenant/saas-feature";

export type GenerationTaskBillingOutcome = "success" | "error" | "cancelled";

export type GenerationTaskBillingHookDependencies = Readonly<{
    reservations: Pick<TaskBillingRepositoryPort, "getByTask">;
    billing: Pick<TaskBillingService, "settle" | "release" | "reverse">;
    recordOutcome?: (input: {
        tenantId: string;
        generationTaskId: string;
        outcome: GenerationTaskBillingOutcome | "reverse";
        sourceEventId: string;
        status: "settled" | "released" | "reversed" | "not_applicable" | "error";
        error?: string;
    }) => Promise<void>;
}>;

export type GenerationTaskBillingOutcomeInput = Readonly<{
    tenantId: string;
    generationTaskId: string;
    outcome: GenerationTaskBillingOutcome;
    billableUsage?: Readonly<{ saleAmount: number; costAmount: number }>;
    sourceEventId: string;
}>;

export type ReverseGenerationTaskBillingInput = Readonly<{
    tenantId: string;
    generationTaskId: string;
    sourceEventId: string;
}>;

export async function applyGenerationTaskBillingOutcome(input: GenerationTaskBillingOutcomeInput, dependencies = createDefaultDependencies()): Promise<void> {
    if (!dependencies) return;
    try {
        const reservation = await dependencies.reservations.getByTask(input.tenantId, input.generationTaskId);
        if (!reservation) {
            await dependencies.recordOutcome?.({ ...input, status: "not_applicable" });
            return;
        }
        assertReservationIdentity(reservation, input.tenantId, input.generationTaskId);

        const idempotencyKey = outcomeIdempotencyKey(input.generationTaskId, input.outcome, input.sourceEventId);
        if (input.outcome === "success") {
            const usage = input.billableUsage || { saleAmount: reservation.saleReserved, costAmount: reservation.costReserved };
            const settled = await dependencies.billing.settle({
                tenantId: input.tenantId,
                generationTaskId: input.generationTaskId,
                actualSaleAmount: usage.saleAmount,
                actualCostAmount: usage.costAmount,
                idempotencyKey,
            });
            await dependencies.recordOutcome?.({ ...input, status: billingOutcomeStatus(settled.status, "settled") });
            return;
        }

        const released = await dependencies.billing.release({
            tenantId: input.tenantId,
            generationTaskId: input.generationTaskId,
            idempotencyKey,
        });
        await dependencies.recordOutcome?.({ ...input, status: billingOutcomeStatus(released.status, "released") });
    } catch (error) {
        await dependencies.recordOutcome?.({
            ...input,
            status: "error",
            error: error instanceof Error ? error.message.slice(0, 500) : "Task billing hook failed",
        }).catch(() => undefined);
        throw error;
    }
}

export async function reverseGenerationTaskBilling(input: ReverseGenerationTaskBillingInput, dependencies = createDefaultDependencies()): Promise<void> {
    if (!dependencies) return;
    try {
        const reservation = await dependencies.reservations.getByTask(input.tenantId, input.generationTaskId);
        if (!reservation) {
            await dependencies.recordOutcome?.({ ...input, outcome: "reverse", status: "not_applicable" });
            return;
        }
        assertReservationIdentity(reservation, input.tenantId, input.generationTaskId);
        const reversed = await dependencies.billing.reverse({
            tenantId: input.tenantId,
            generationTaskId: input.generationTaskId,
            idempotencyKey: outcomeIdempotencyKey(input.generationTaskId, "reverse", input.sourceEventId),
        });
        await dependencies.recordOutcome?.({ ...input, outcome: "reverse", status: billingOutcomeStatus(reversed.status, "reversed") });
    } catch (error) {
        await dependencies.recordOutcome?.({
            ...input,
            outcome: "reverse",
            status: "error",
            error: error instanceof Error ? error.message.slice(0, 500) : "Task billing reversal failed",
        }).catch(() => undefined);
        throw error;
    }
}

export function outcomeIdempotencyKey(taskId: string, outcome: string, sourceEventId: string) {
    return `generation-task-billing:${taskId}:${outcome}:${sourceEventId}`;
}

function createDefaultDependencies(): GenerationTaskBillingHookDependencies | null {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return null;
    const repositories = createPostgresRepositories();
    const billing = createPostgresTaskBillingService();
    return {
        reservations: repositories.taskBilling,
        billing,
        recordOutcome: async (input) => {
            await ensurePostgresSchema();
            await postgresQuery(
                `UPDATE generation_tasks
                 SET payload = payload || $3::jsonb
                 WHERE id = $1 AND tenant_id = $2`,
                [
                    input.generationTaskId,
                    input.tenantId,
                    JSON.stringify({
                        taskBilling: {
                            status: input.status,
                            outcome: input.outcome,
                            sourceEventId: input.sourceEventId,
                            ...(input.error ? { error: input.error } : {}),
                            updatedAt: Date.now(),
                        },
                    }),
                ],
            );
        },
    };
}

function assertReservationIdentity(reservation: TaskBillingReservationRecord, tenantId: string, generationTaskId: string) {
    if (reservation.tenantId !== tenantId) throw new Error("Task billing reservation tenant does not match the task outcome");
    if (reservation.generationTaskId !== generationTaskId) throw new Error("Task billing reservation task does not match the task outcome");
    if (reservation.snapshot.tenantId !== tenantId || reservation.snapshot.generationTaskId !== generationTaskId) {
        throw new Error("Task billing snapshot does not match the task outcome");
    }
}

function billingOutcomeStatus(status: string, fallback: "settled" | "released" | "reversed") {
    return status === "settled" || status === "released" || status === "reversed" || status === "not_applicable" || status === "error" ? status : fallback;
}
