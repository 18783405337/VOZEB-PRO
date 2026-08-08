import { describe, expect, it } from "vitest";

import { POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL } from "./schema-image-human";

describe("image human schema", () => {
    it("creates tenant-scoped configs, tasks, and results", () => {
        for (const table of ["image_human_configs", "image_human_tasks", "image_human_results"]) {
            expect(POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
            expect(POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL).toContain("tenant_id text NOT NULL REFERENCES tenants(id)");
        }
    });

    it("keeps task and result identifiers compatible with generation task identifiers", () => {
        expect(POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL).toMatch(/CREATE TABLE IF NOT EXISTS image_human_tasks \(\s+id text PRIMARY KEY/);
        expect(POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL).toMatch(/CREATE TABLE IF NOT EXISTS image_human_results \(\s+id text PRIMARY KEY/);
        expect(POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL).toContain("task_id text NOT NULL UNIQUE REFERENCES image_human_tasks(id)");
    });

    it("enforces owner-scoped indexes and bounded task state", () => {
        expect(POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL).toContain("ON image_human_tasks (tenant_id, user_id, status");
        expect(POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL).toContain("ON image_human_results (tenant_id, user_id");
        expect(POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL).toContain("CONSTRAINT image_human_tasks_status CHECK");
        expect(POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL).toContain("CONSTRAINT image_human_tasks_progress CHECK (progress >= 0 AND progress <= 100)");
    });
});
