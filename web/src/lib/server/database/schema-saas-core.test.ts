import { describe, expect, it } from "vitest";

import { POSTGRESQL_SAAS_CORE_SCHEMA_SQL } from "./schema-saas-core";

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
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("conrelid = 'tenant_roles'::regclass");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("conrelid = 'tenant_role_permissions'::regclass");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("conrelid = 'tenant_members'::regclass");
    });
});
