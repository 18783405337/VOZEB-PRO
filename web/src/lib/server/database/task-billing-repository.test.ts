import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "@/lib/server/database/postgres";
import { TaskBillingRepository } from "./task-billing-repository";

function queryResult(rows: Record<string, unknown>[] = []) {
    return { rows, rowCount: rows.length };
}

function row(overrides: Record<string, unknown> = {}) {
    return {
        id: "reservation-a",
        tenant_id: "tenant-a",
        generation_task_id: "task-a",
        user_wallet_id: "wallet-a",
        power_account_id: "power-a",
        sale_reserved: 20,
        cost_reserved: 10,
        sale_settled: 15,
        cost_settled: 6,
        status: "settled",
        idempotency_key: "reserve-task-a",
        snapshot_json: { tenantId: "tenant-a", generationTaskId: "task-a" },
        created_at: 1,
        updated_at: 2,
        ...overrides,
    };
}

describe("task billing repository", () => {
    it("loads reservations with tenant and task scope and row locking", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([row()]));
        const repository = new TaskBillingRepository({ query } as unknown as QueryExecutor);

        const result = await repository.getByTask("tenant-a", "task-a", true);

        expect(result).toMatchObject({ id: "reservation-a", tenantId: "tenant-a", status: "settled", snapshot: { generationTaskId: "task-a" } });
        expect(query.mock.calls[0]?.[0]).toContain("tenant_id = $1 AND generation_task_id = $2");
        expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
        expect(query.mock.calls[0]?.[1]).toEqual(["tenant-a", "task-a"]);
    });

    it("creates a reservation and maps JSON snapshots", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([row({ status: "reserved", sale_settled: 0, cost_settled: 0 })]));
        const repository = new TaskBillingRepository({ query } as unknown as QueryExecutor);

        const result = await repository.create({
            id: "reservation-a",
            tenantId: "tenant-a",
            generationTaskId: "task-a",
            userWalletId: "wallet-a",
            powerAccountId: "power-a",
            saleReserved: 20,
            costReserved: 10,
            saleSettled: 0,
            costSettled: 0,
            status: "reserved",
            idempotencyKey: "reserve-task-a",
            snapshot: { tenantId: "tenant-a", generationTaskId: "task-a" },
        });

        expect(result.status).toBe("reserved");
        expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT DO NOTHING");
        expect(query.mock.calls[0]?.[1]).toContain(JSON.stringify({ tenantId: "tenant-a", generationTaskId: "task-a" }));
    });

    it("updates only the tenant-scoped reservation row", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([row({ status: "reversed" })]));
        const repository = new TaskBillingRepository({ query } as unknown as QueryExecutor);

        const result = await repository.update({
            tenantId: "tenant-a",
            generationTaskId: "task-a",
            patch: { status: "reversed", saleSettled: 15, costSettled: 6 },
        });

        expect(result.status).toBe("reversed");
        expect(query.mock.calls[0]?.[0]).toContain("WHERE tenant_id = $4 AND generation_task_id = $5");
        expect(query.mock.calls[0]?.[1]).toEqual(["reversed", 15, 6, "tenant-a", "task-a", expect.any(Number)]);
    });
});
