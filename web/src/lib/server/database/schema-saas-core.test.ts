import { describe, expect, it } from "vitest";

import { POSTGRESQL_SAAS_CORE_SCHEMA_SQL, POSTGRESQL_SAAS_RESOURCE_SCHEMA_SQL } from "./schema-saas-core";

describe("SaaS core schema", () => {
    it("creates the default tenant, membership, role, and permission tables", () => {
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenants");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("VALUES ('default', 'default', '默认租户'");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenant_members");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenant_roles");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenant_role_permissions");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CONSTRAINT tenant_roles_tenant_id_id_key UNIQUE (tenant_id, id)");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("FOREIGN KEY (tenant_id, role_id)");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("REFERENCES tenant_roles(tenant_id, id)");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("INSERT INTO tenant_role_permissions");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("'tenant.members.manage'");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("'tenant.merchants.manage'");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("conrelid = 'tenant_roles'::regclass");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("conrelid = 'tenant_role_permissions'::regclass");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("conrelid = 'tenant_members'::regclass");
    });

    it("backfills legacy resource rows before enforcing tenant ownership", () => {
        for (const table of ["generation_tasks", "generation_logs", "creative_assets", "billing_orders"]) {
            expect(POSTGRESQL_SAAS_RESOURCE_SCHEMA_SQL).toContain(`UPDATE ${table} SET tenant_id = 'default' WHERE tenant_id IS NULL;`);
            expect(POSTGRESQL_SAAS_RESOURCE_SCHEMA_SQL).toContain(`ALTER TABLE ${table} ALTER COLUMN tenant_id SET NOT NULL;`);
        }
    });

    it("creates tenant-leading indexes for tenant-scoped resource queries", () => {
        for (const index of [
            "generation_logs_tenant_user_created_idx",
            "creative_conversations_tenant_user_updated_idx",
            "local_media_assets_tenant_owner_created_idx",
            "canvas_projects_tenant_user_updated_idx",
            "library_assets_tenant_user_updated_idx",
            "drama_projects_tenant_user_updated_idx",
            "published_works_tenant_owner_created_idx",
            "billing_orders_tenant_user_created_idx",
        ]) {
            expect(POSTGRESQL_SAAS_RESOURCE_SCHEMA_SQL).toContain(`CREATE INDEX IF NOT EXISTS ${index}`);
        }
    });
});
