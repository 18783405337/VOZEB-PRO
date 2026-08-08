import { describe, expect, it } from "vitest";

import { POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL } from "./schema-action-transfer";

describe("action transfer schema", () => {
    it("creates tenant-scoped configs, tasks, and results", () => {
        for (const table of ["action_transfer_configs", "action_transfer_tasks", "action_transfer_results"]) {
            expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
            expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain("tenant_id text NOT NULL REFERENCES tenants(id)");
        }
    });

    it("stores the complete action transfer request and runtime state", () => {
        for (const column of [
            "reference_images jsonb NOT NULL",
            "source_video_uri text NOT NULL",
            "prompt text NOT NULL",
            "mode text NOT NULL",
            "face_count integer NOT NULL",
            "duration_seconds integer NOT NULL",
            "provider text NOT NULL",
            "model text NOT NULL",
            "provider_task_id text NOT NULL",
            "provider_stage text NOT NULL",
            "provider_payload jsonb NOT NULL",
            "status text NOT NULL",
            "progress integer NOT NULL",
            "error text NOT NULL",
            "result_payload jsonb NOT NULL",
        ]) {
            expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain(column);
        }
    });

    it("supports generation-task-aligned ids and owner-scoped indexes", () => {
        expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toMatch(/CREATE TABLE IF NOT EXISTS action_transfer_tasks \(\s+id text PRIMARY KEY/);
        expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toMatch(/CREATE TABLE IF NOT EXISTS action_transfer_results \(\s+id text PRIMARY KEY/);
        expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain("task_id text NOT NULL UNIQUE REFERENCES action_transfer_tasks(id)");
        expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain("ON action_transfer_tasks (tenant_id, user_id, status");
        expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain("ON action_transfer_results (tenant_id, user_id");
    });

    it("bounds task state and numeric inputs", () => {
        expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain("CONSTRAINT action_transfer_tasks_status CHECK");
        expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain("CONSTRAINT action_transfer_tasks_progress CHECK (progress >= 0 AND progress <= 100)");
        expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain("CONSTRAINT action_transfer_tasks_face_count CHECK (face_count >= 0)");
        expect(POSTGRESQL_ACTION_TRANSFER_SCHEMA_SQL).toContain("CONSTRAINT action_transfer_tasks_duration CHECK (duration_seconds >= 0)");
    });
});
