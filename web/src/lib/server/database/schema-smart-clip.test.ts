import { describe, expect, it } from "vitest";

import { POSTGRESQL_SMART_CLIP_SCHEMA_SQL } from "./schema-smart-clip";

describe("smart clip schema", () => {
    it("creates the migrated smart clip tables", () => {
        for (const table of ["smart_clip_configs", "smart_clip_tasks", "smart_clip_results", "smart_clip_channels", "smart_clip_channel_specs", "smart_clip_billings", "smart_clip_sensitive_words"]) {
            expect(POSTGRESQL_SMART_CLIP_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
            expect(POSTGRESQL_SMART_CLIP_SCHEMA_SQL).toContain("tenant_id text NOT NULL REFERENCES tenants(id)");
        }
    });

    it("preserves the three source clip modes and task lifecycle", () => {
        expect(POSTGRESQL_SMART_CLIP_SCHEMA_SQL).toContain("'realman_broadcast', 'broadcast_mixcut', 'news_mixcut'");
        expect(POSTGRESQL_SMART_CLIP_SCHEMA_SQL).toContain("'pending', 'running', 'success', 'error', 'cancelled'");
    });
});
