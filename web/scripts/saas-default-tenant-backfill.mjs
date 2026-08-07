import { Client } from "pg";

import {
    assertWriteConfirmation,
    buildBackfillReport,
    executeBackfillWrite,
    parseBackfillArguments,
    TENANT_ROOT_TABLES,
    validateBackfillState,
} from "./lib/saas-default-tenant-backfill-core.mjs";

const TABLE_PREFIX = "vozeb_pro_";
const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();

async function main() {
    const options = parseBackfillArguments(process.argv.slice(2));
    if (!databaseUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required");

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
        const databaseResult = await client.query("SELECT current_database() AS database_name");
        const databaseName = String(databaseResult.rows[0]?.database_name || "");
        assertWriteConfirmation(options, databaseName);

        const state = await inspectBackfillState(client);
        const report = buildBackfillReport({
            databaseName,
            counts: state.counts,
            nullCounts: state.nullCounts,
            orphanReferences: state.orphanReferences,
            tenantConflicts: state.tenantConflicts,
        });

        if (!options.write) {
            console.log(JSON.stringify({ mode: "dry-run", ...report }, null, 2));
            return;
        }

        validateBackfillState(state);
        const result = await executeBackfillWrite({
            client,
            databaseName,
            options,
            ...state,
            verifyTenantConflicts: () => findTenantConflicts(client),
        });
        console.log(JSON.stringify({ mode: "write", ...report, result }, null, 2));
    } finally {
        await client.end();
    }
}

async function inspectBackfillState(client) {
    const counts = {};
    const nullCounts = {};
    for (const table of TENANT_ROOT_TABLES) {
        const result = await client.query(
            `SELECT count(*)::int AS count, count(*) FILTER (WHERE tenant_id IS NULL)::int AS null_count FROM ${TABLE_PREFIX}${table}`,
        );
        counts[table] = Number(result.rows[0]?.count || 0);
        nullCounts[table] = Number(result.rows[0]?.null_count || 0);
    }

    const orphanReferences = [];
    const orphanChecks = [
        ["generation_tasks", "id", "user_id", "users", "id"],
        ["generation_tasks", "id", "conversation_id", "creative_conversations", "id"],
        ["generation_logs", "id", "user_id", "users", "id"],
        ["generation_logs", "id", "conversation_id", "creative_conversations", "id"],
        ["creative_conversations", "id", "user_id", "users", "id"],
        ["creative_assets", "id", "user_id", "users", "id"],
        ["creative_assets", "id", "conversation_id", "creative_conversations", "id"],
        ["local_media_assets", "storage_key", "owner_user_id", "users", "id"],
        ["local_media_assets", "storage_key", "conversation_id", "creative_conversations", "id"],
        ["canvas_projects", "id", "user_id", "users", "id"],
        ["library_assets", "id", "user_id", "users", "id"],
        ["drama_projects", "id", "user_id", "users", "id"],
        ["published_works", "id", "owner_user_id", "users", "id"],
        ["billing_orders", "id", "user_id", "users", "id"],
    ];
    for (const [table, rowKey, foreignKey, parentTable, parentKey] of orphanChecks) {
        const result = await client.query(
            `SELECT child.${rowKey} AS row_key, child.${foreignKey} AS reference_value
             FROM ${TABLE_PREFIX}${table} child
             LEFT JOIN ${TABLE_PREFIX}${parentTable} parent ON parent.${parentKey} = child.${foreignKey}
             WHERE child.${foreignKey} IS NOT NULL AND parent.${parentKey} IS NULL
             LIMIT 20`,
        );
        for (const row of result.rows) {
            orphanReferences.push({
                table,
                column: foreignKey,
                rowKey: row.row_key,
                value: row.reference_value,
            });
        }
    }

    const tenantConflicts = await findTenantConflicts(client);
    return { counts, nullCounts, orphanReferences, tenantConflicts };
}

async function findTenantConflicts(client) {
    const tenantConflicts = [];
    const conflictChecks = [
        ["generation_tasks", "id", "conversation_id", "creative_conversations"],
        ["generation_logs", "id", "conversation_id", "creative_conversations"],
        ["creative_assets", "id", "conversation_id", "creative_conversations"],
        ["local_media_assets", "storage_key", "conversation_id", "creative_conversations"],
    ];
    for (const [childTable, rowKey, foreignKey, parentTable] of conflictChecks) {
        const result = await client.query(
            `SELECT child.${rowKey} AS child_id, child.tenant_id AS child_tenant_id, parent.tenant_id AS parent_tenant_id
             FROM ${TABLE_PREFIX}${childTable} child
             JOIN ${TABLE_PREFIX}${parentTable} parent ON parent.id = child.${foreignKey}
             WHERE child.${foreignKey} IS NOT NULL
               AND child.tenant_id IS NOT NULL
               AND parent.tenant_id IS NOT NULL
               AND child.tenant_id <> parent.tenant_id
             LIMIT 20`,
        );
        for (const row of result.rows) {
            tenantConflicts.push({
                parentTable,
                childTable,
                id: row.child_id,
                childTenantId: row.child_tenant_id,
                parentTenantId: row.parent_tenant_id,
            });
        }
    }
    return tenantConflicts;
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
