import { describe, expect, it } from "vitest";

import { POSTGRESQL_DIGITAL_HUMAN_SCHEMA_SQL } from "./schema-digital-human";

describe("digital human schema", () => {
    it("creates tenant-scoped assets, tasks, results, quotas, and sensitive words", () => {
        for (const table of ["digital_human_configs", "digital_human_avatars", "digital_human_voices", "digital_human_tasks", "digital_human_results", "digital_human_quotas", "digital_human_sensitive_words"]) {
            expect(POSTGRESQL_DIGITAL_HUMAN_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
            expect(POSTGRESQL_DIGITAL_HUMAN_SCHEMA_SQL).toContain(`tenant_id text NOT NULL REFERENCES tenants(id)`);
        }
    });

    it("allows platform-owned official avatar and voice assets", () => {
        expect(POSTGRESQL_DIGITAL_HUMAN_SCHEMA_SQL).toContain("user_id text REFERENCES users(id) ON DELETE CASCADE");
        expect(POSTGRESQL_DIGITAL_HUMAN_SCHEMA_SQL).toContain("CONSTRAINT digital_human_avatars_source CHECK");
        expect(POSTGRESQL_DIGITAL_HUMAN_SCHEMA_SQL).toContain("CONSTRAINT digital_human_voices_source CHECK");
    });
});
