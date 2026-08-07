export const DEFAULT_TENANT = Object.freeze({
    id: "default",
    slug: "default",
    name: "Default Tenant",
});

export const TENANT_ROOT_TABLES = [
    "generation_tasks",
    "generation_logs",
    "creative_conversations",
    "creative_assets",
    "local_media_assets",
    "canvas_projects",
    "library_assets",
    "drama_projects",
    "published_works",
    "billing_orders",
];

export const TENANT_ROOT_CONSTRAINTS = TENANT_ROOT_TABLES.map((table) => `${table}.tenant_id SET NOT NULL`);

export function parseBackfillArguments(values) {
    const options = { dryRun: true };
    for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (value === "--write") {
            options.write = true;
            options.dryRun = false;
            continue;
        }
        if (value === "--dry-run") {
            options.dryRun = true;
            options.write = false;
            continue;
        }
        if (value === "--confirm-database") {
            options.confirmDatabase = values[index + 1];
            index += 1;
            continue;
        }
        throw new Error(`Unknown backfill option: ${value}`);
    }
    if (options.write && !options.confirmDatabase) {
        throw new Error("Write mode requires --confirm-database <database-name>");
    }
    return options;
}

export function assertWriteConfirmation(options, databaseName) {
    if (!options.write) return;
    if (options.confirmDatabase !== databaseName) {
        throw new Error(`Database confirmation does not match: expected ${databaseName}`);
    }
}

export function buildBackfillReport({ databaseName, counts, nullCounts, orphanReferences = [], tenantConflicts = [] }) {
    const tables = Object.fromEntries(
        TENANT_ROOT_TABLES.map((table) => [
            table,
            {
                count: Number(counts[table] || 0),
                nullTenantId: Number(nullCounts[table] || 0),
            },
        ]),
    );
    return {
        databaseName,
        defaultTenant: DEFAULT_TENANT,
        tables,
        plannedConstraints: [...TENANT_ROOT_CONSTRAINTS],
        plannedIndexes: [
            "generation_tasks_tenant_user_client_request_idx",
        ],
        orphanReferences,
        tenantConflicts,
    };
}

export function validateBackfillState({ orphanReferences = [], tenantConflicts = [] }) {
    if (orphanReferences.length) {
        const first = orphanReferences[0];
        throw new Error(`Cannot backfill because orphan reference exists: ${formatIssue(first)}`);
    }
    if (tenantConflicts.length) {
        const first = tenantConflicts[0];
        throw new Error(`Cannot backfill because cross-tenant conflict exists: ${formatIssue(first)}`);
    }
}

export async function executeBackfillWrite({
    client,
    databaseName,
    options,
    orphanReferences = [],
    tenantConflicts = [],
    verifyTenantConflicts = async () => [],
    tablePrefix = "vozeb_pro_",
}) {
    assertWriteConfirmation(options, databaseName);
    validateBackfillState({ orphanReferences, tenantConflicts });

    await client.query("BEGIN");
    try {
        for (const table of TENANT_ROOT_TABLES) {
            await client.query(
                `UPDATE ${tablePrefix}${table} SET tenant_id = $1 WHERE tenant_id IS NULL`,
                [DEFAULT_TENANT.id],
            );
        }
        const postWriteConflicts = await verifyTenantConflicts();
        validateBackfillState({ tenantConflicts: postWriteConflicts });

        const remainingNullCounts = {};
        for (const table of TENANT_ROOT_TABLES) {
            const result = await client.query(
                `SELECT count(*)::int AS null_count FROM ${tablePrefix}${table} WHERE tenant_id IS NULL`,
            );
            remainingNullCounts[table] = Number(result.rows[0]?.null_count || 0);
        }
        const remainingNulls = Object.values(remainingNullCounts).some((count) => count > 0);
        if (remainingNulls) {
            throw new Error(`Backfill left NULL tenant_id values: ${JSON.stringify(remainingNullCounts)}`);
        }
        for (const table of TENANT_ROOT_TABLES) {
            await client.query(
                `ALTER TABLE ${tablePrefix}${table} ALTER COLUMN tenant_id SET NOT NULL`,
            );
        }
        await client.query("COMMIT");
        return { remainingNullCounts };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
}

function formatIssue(issue) {
    return Object.entries(issue)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");
}
