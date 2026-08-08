import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    connect: vi.fn(),
    pool: vi.fn(),
}));

vi.mock("pg", () => ({
    Pool: mocks.pool,
}));

import { ensurePostgresSchema, initializePostgresSchema, withPostgresTransaction } from "./postgres";

describe("PostgreSQL schema lifecycle", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__vozebProPostgresPool;
        delete (globalThis as Record<string, unknown>).__vozebProPostgresSchemaReady;
        process.env.DATABASE_URL = "postgres://vozeb:test@localhost:5432/vozeb";
        mocks.query.mockReset();
        mocks.connect.mockReset();
        mocks.pool.mockReset().mockImplementation(function PoolMock() {
            return { query: mocks.query, connect: mocks.connect };
        });
    });

    it("serializes concurrent repository queries on one transaction client", async () => {
        let active = false;
        const statements: string[] = [];
        const release = vi.fn();
        const clientQuery = vi.fn(async (statement: string) => {
            statements.push(statement);
            if (statement === "BEGIN" || statement === "COMMIT" || statement === "ROLLBACK") return { rows: [], rowCount: 0 };
            if (active) throw new Error("transaction client received concurrent queries");
            active = true;
            await new Promise((resolve) => setTimeout(resolve, 0));
            active = false;
            return { rows: [], rowCount: 0 };
        });
        mocks.connect.mockResolvedValue({ query: clientQuery, release });

        await withPostgresTransaction(async (client) => {
            await Promise.all([client.query("SELECT 1"), client.query("SELECT 2"), client.query("SELECT 3")]);
        });

        expect(statements).toEqual(["BEGIN", "SELECT 1", "SELECT 2", "SELECT 3", "COMMIT"]);
        expect(release).toHaveBeenCalledOnce();
    });

    it("does not execute schema DDL when an ordinary caller reaches an empty database", async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ table_name: null }] });

        await expect(ensurePostgresSchema()).rejects.toThrow("PostgreSQL schema has not been initialized");

        expect(mocks.query).toHaveBeenCalledTimes(1);
        expect(mocks.query.mock.calls[0]?.[0]).toContain("to_regclass");
        expect(mocks.query.mock.calls[0]?.[0]).not.toContain("CREATE TABLE");
    });

    it("executes schema DDL only through explicit initialization", async () => {
        mocks.query.mockResolvedValueOnce({ rows: [] });

        await initializePostgresSchema();

        expect(mocks.query).toHaveBeenCalledTimes(1);
        const ddl = String(mocks.query.mock.calls[0]?.[0]);
        expect(ddl).toContain("CREATE TABLE IF NOT EXISTS vozeb_pro_schema_migrations");
        expect(ddl).toContain("CREATE TABLE IF NOT EXISTS vozeb_pro_generation_worker_heartbeats");
        expect(ddl).toContain("CREATE SEQUENCE IF NOT EXISTS vozeb_pro_user_account_id_seq");
        expect(ddl).toContain("account_id bigint NOT NULL DEFAULT nextval('vozeb_pro_user_account_id_seq')");
        expect(ddl).toContain("CREATE UNIQUE INDEX IF NOT EXISTS vozeb_pro_users_account_id_idx ON vozeb_pro_users (account_id)");
        expect(ddl).toContain("webhook_secret_ciphertext text NOT NULL DEFAULT ''");
        expect(ddl).toContain("CREATE UNIQUE INDEX IF NOT EXISTS vozeb_pro_generation_tasks_channel_upstream_idx ON vozeb_pro_generation_tasks (channel_id, upstream_task_id)");
        expect(ddl).toContain("ALTER TABLE vozeb_pro_generation_tasks ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES vozeb_pro_tenants(id)");
        expect(ddl).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS vozeb_pro_generation_tasks_tenant_user_client_request_idx\s+ON vozeb_pro_generation_tasks \(tenant_id, user_id, task_type, client_request_id, COALESCE\(attempt_no, 0\)\)/);
        expect(ddl).not.toContain("CREATE UNIQUE INDEX vozeb_pro_generation_tasks_user_client_request_idx");
        expect(ddl).toContain("ALTER TABLE vozeb_pro_generation_tasks ALTER COLUMN tenant_id SET NOT NULL");
        expect(ddl).toMatch(/UPDATE\s+vozeb_pro_(generation_tasks|generation_logs|creative_conversations|creative_assets|local_media_assets|canvas_projects|library_assets|drama_projects|published_works|billing_orders)\s+SET\s+tenant_id/i);
        expect(ddl).toContain("ALTER TABLE vozeb_pro_billing_orders ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES vozeb_pro_tenants(id)");
        for (const table of [
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
        ]) {
            expect(ddl).toContain(`ALTER TABLE vozeb_pro_${table} ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES vozeb_pro_tenants(id)`);
            expect(ddl).toMatch(new RegExp(`ALTER TABLE vozeb_pro_${table} ALTER COLUMN tenant_id SET NOT NULL`, "i"));
        }
        expect(ddl).toContain("WHERE client_request_id IS NOT NULL");
        expect(ddl).toContain("signature_timestamp timestamptz NOT NULL");
        expect(ddl).toContain("conflict_count integer NOT NULL DEFAULT 0");
        expect(ddl).toContain("user_id text NOT NULL REFERENCES vozeb_pro_users(id) ON DELETE CASCADE");
        expect(ddl).toContain("CREATE TABLE IF NOT EXISTS vozeb_pro_account_deletion_requests");
        expect(ddl).toContain("CREATE TABLE IF NOT EXISTS vozeb_pro_tenants");
        expect(ddl).toContain("CREATE TABLE IF NOT EXISTS vozeb_pro_tenant_members");
        expect(ddl).toContain("CREATE UNIQUE INDEX IF NOT EXISTS vozeb_pro_tenant_domains_hostname_lower_idx");
        expect(ddl).toContain("VALUES ('default', 'default', '默认租户', 'active')");
        expect(ddl).toContain("CONSTRAINT vozeb_pro_tenant_roles_tenant_id_id_key UNIQUE (tenant_id, id)");
        expect(ddl).toContain("CONSTRAINT vozeb_pro_tenant_members_tenant_role_fkey");
        expect(ddl).toContain("conrelid = 'vozeb_pro_tenant_roles'::regclass");
        expect(ddl).toContain("conrelid = 'vozeb_pro_tenant_role_permissions'::regclass");
        expect(ddl).toContain("conrelid = 'vozeb_pro_tenant_members'::regclass");
        expect(ddl).toContain("CREATE TRIGGER vozeb_pro_tenants_set_updated_at BEFORE UPDATE ON vozeb_pro_tenants FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at()");
        expect(ddl).toContain("'review_pending', 'reviewing', 'review_unavailable'");
        expect(ddl).toContain("task_type = 'agent' AND status = 'success' AND execution_phase IN ('review_pending', 'reviewing')");

        const tableNames = [...ddl.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z][a-z0-9_]*)/gi)].map((match) => match[1]).sort();
        const applicationTables = ["apps", "app_versions", "tenant_apps", "tenant_app_settings", "tenant_app_pricing"];
        const saasBillingTables = [
            "tenant_user_wallets",
            "tenant_user_wallet_ledger_entries",
            "tenant_power_accounts",
            "tenant_power_ledger_entries",
            "tenant_settlement_accounts",
            "tenant_settlement_ledger_entries",
            "merchant_accounts",
            "task_billing_reservations",
        ];
        expect(tableNames).toHaveLength(77);
        expect(tableNames.every((name) => name.startsWith("vozeb_pro_"))).toBe(true);
        expect(tableNames).not.toContain("vozeb_pro_check_ins");
        for (const table of [...applicationTables, ...saasBillingTables]) {
            expect(tableNames).toContain(`vozeb_pro_${table}`);
        }
        expect(ddl).toContain("ALTER TABLE vozeb_pro_billing_orders ADD COLUMN IF NOT EXISTS collection_mode text");
        expect(ddl).toContain("ALTER TABLE vozeb_pro_billing_orders ADD COLUMN IF NOT EXISTS merchant_account_id text REFERENCES vozeb_pro_merchant_accounts(id)");
        expect(ddl).toContain("ALTER TABLE vozeb_pro_payment_transactions ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES vozeb_pro_tenants(id)");
        expect(ddl).toContain("ALTER TABLE vozeb_pro_billing_refund_jobs ADD COLUMN IF NOT EXISTS merchant_account_id text REFERENCES vozeb_pro_merchant_accounts(id)");
        expect(ddl).toContain("DROP TABLE IF EXISTS vozeb_pro_check_ins");
        expect(ddl).not.toContain("20260731_generation_task_recovery");

        const indexNames = [...ddl.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z][a-z0-9_]*)/gi)].map((match) => match[1]);
        expect(indexNames.length).toBeGreaterThan(0);
        expect(indexNames.every((name) => name.startsWith("vozeb_pro_"))).toBe(true);

        expect(ddl).toContain("CREATE TRIGGER vozeb_pro_tenant_domains_set_updated_at");
        expect(ddl).toContain("CREATE TRIGGER vozeb_pro_tenant_roles_set_updated_at");
        expect(ddl).toContain("CREATE TRIGGER vozeb_pro_tenant_members_set_updated_at");

        const uniqueConstraintNames = [...ddl.matchAll(/CONSTRAINT\s+([a-z][a-z0-9_]*)\s+UNIQUE\b/gi)].map((match) => match[1]);
        expect(uniqueConstraintNames.length).toBeGreaterThan(0);
        expect(uniqueConstraintNames.every((name) => name.startsWith("vozeb_pro_"))).toBe(true);
    });

    it("continues applying additive schema updates after the sentinel table exists", async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ table_name: "vozeb_pro_users" }] }).mockResolvedValueOnce({ rows: [] });

        await ensurePostgresSchema();

        expect(mocks.query).toHaveBeenCalledTimes(2);
        expect(mocks.query.mock.calls[0]?.[0]).toContain("to_regclass");
        expect(mocks.query.mock.calls[1]?.[0]).toContain("CREATE TABLE IF NOT EXISTS vozeb_pro_schema_migrations");
    });
});
