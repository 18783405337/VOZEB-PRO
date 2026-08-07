import { describe, expect, it, vi } from "vitest";

import {
    DEFAULT_TENANT,
    buildBackfillReport,
    executeBackfillWrite,
    parseBackfillArguments,
    validateBackfillState,
} from "./saas-default-tenant-backfill-core.mjs";

describe("SaaS default tenant backfill core", () => {
    it("defaults to dry-run and requires an exact database confirmation for writes", () => {
        expect(parseBackfillArguments([])).toEqual({ dryRun: true });
        expect(parseBackfillArguments(["--dry-run"])).toEqual({ dryRun: true, write: false });
        expect(parseBackfillArguments(["--write", "--confirm-database", "vozeb_saas_test"])).toEqual({
            dryRun: false,
            write: true,
            confirmDatabase: "vozeb_saas_test",
        });
        expect(() => parseBackfillArguments(["--write"])).toThrow(/confirm-database/i);
    });

    it("builds a dry-run report with counts, nulls, and planned constraints", () => {
        const report = buildBackfillReport({
            databaseName: "vozeb_saas_test",
            counts: {
                generation_tasks: 12,
                generation_logs: 4,
                creative_conversations: 3,
            },
            nullCounts: {
                generation_tasks: 12,
                generation_logs: 4,
                creative_conversations: 3,
            },
        });

        expect(report.databaseName).toBe("vozeb_saas_test");
        expect(report.defaultTenant).toEqual(DEFAULT_TENANT);
        expect(report.tables.generation_tasks).toEqual({ count: 12, nullTenantId: 12 });
        expect(report.plannedConstraints).toContain("generation_tasks.tenant_id SET NOT NULL");
    });

    it("rejects orphan and cross-tenant conflicts before writes", () => {
        expect(() =>
            validateBackfillState({
                orphanReferences: [{ table: "generation_tasks", column: "user_id", value: "missing-user" }],
                tenantConflicts: [{ parentTable: "creative_conversations", childTable: "generation_logs", id: "log-1" }],
            }),
        ).toThrow(/orphan|cross-tenant/i);
    });

    it("does not start a write transaction when validation fails", async () => {
        const begin = vi.fn();

        await expect(
            executeBackfillWrite({
                client: { query: begin },
                databaseName: "vozeb_saas_test",
                options: { write: true, confirmDatabase: "vozeb_saas_test" },
                orphanReferences: [{ table: "creative_assets", column: "conversation_id", value: "missing-conversation" }],
                tenantConflicts: [],
            }),
        ).rejects.toThrow("orphan");

        expect(begin).not.toHaveBeenCalled();
    });

    it("rechecks cross-tenant conflicts after nulls are assigned", async () => {
        const statements = [];
        const query = vi.fn(async (sql) => {
            statements.push(sql);
            if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
            if (sql.startsWith("UPDATE")) return { rows: [] };
            if (sql.startsWith("SELECT count")) return { rows: [{ null_count: 0 }] };
            return { rows: [] };
        });

        await expect(
            executeBackfillWrite({
                client: { query },
                databaseName: "vozeb_saas_test",
                options: { write: true, confirmDatabase: "vozeb_saas_test" },
                verifyTenantConflicts: async () => [
                    {
                        parentTable: "creative_conversations",
                        childTable: "generation_logs",
                        id: "log-1",
                    },
                ],
            }),
        ).rejects.toThrow(/cross-tenant/i);

        expect(statements).toContain("ROLLBACK");
        expect(statements.some((sql) => sql.startsWith("ALTER TABLE"))).toBe(false);
    });

    it("updates only NULL rows and applies NOT NULL after zero-null verification", async () => {
        const statements = [];
        const query = vi.fn(async (sql) => {
            statements.push(sql);
            if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
            if (sql.startsWith("UPDATE")) return { rows: [] };
            if (sql.startsWith("SELECT count")) return { rows: [{ null_count: 0 }] };
            if (sql.startsWith("ALTER TABLE")) return { rows: [] };
            throw new Error(`Unexpected query: ${sql}`);
        });

        await executeBackfillWrite({
            client: { query },
            databaseName: "vozeb_saas_test",
            options: { write: true, confirmDatabase: "vozeb_saas_test" },
        });

        const lastUpdate = Math.max(...statements.map((sql, index) => (sql.startsWith("UPDATE") ? index : -1)));
        const firstNullCheck = statements.findIndex((sql) => sql.startsWith("SELECT count"));
        const firstConstraint = statements.findIndex((sql) => sql.startsWith("ALTER TABLE"));
        expect(lastUpdate).toBeLessThan(firstNullCheck);
        expect(firstNullCheck).toBeLessThan(firstConstraint);
        expect(statements.at(-1)).toBe("COMMIT");
        expect(statements.filter((sql) => sql.startsWith("UPDATE") && sql.includes("WHERE tenant_id IS NULL")).length).toBe(10);
    });
});
