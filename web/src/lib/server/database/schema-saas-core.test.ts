import { describe, expect, it } from "vitest";

import { POSTGRESQL_SAAS_CORE_SCHEMA_SQL } from "./schema-saas-core";

describe("SaaS core schema", () => {
    it("creates the default tenant, membership, role, and permission tables", () => {
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenants");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("VALUES ('default', 'default', '默认租户'");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenant_members");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenant_roles");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenant_role_permissions");
    });
});
