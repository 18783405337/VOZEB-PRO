import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "./postgres";
import { ImageHumanRepository } from "./image-human-repository";

function queryResult(rows: Record<string, unknown>[] = []) {
    return { rows, rowCount: rows.length };
}

function taskRow(overrides: Record<string, unknown> = {}) {
    const timestamp = "2026-08-08T00:00:00.000Z";
    return {
        id: "task-1",
        tenant_id: "tenant-a",
        user_id: "user-a",
        title: "Product presenter",
        source_image_uri: "https://cdn.example/presenter.png",
        reference_audio_uri: "https://cdn.example/voice.mp3",
        script_text: "Hello",
        prompt: "Natural delivery",
        mode: "standard",
        duration_seconds: 8,
        provider: "xhadmin",
        model: "image-human",
        provider_task_id: "",
        provider_stage: "queued",
        provider_payload: {},
        status: "pending",
        progress: 0,
        error: "",
        result_payload: {},
        created_at: timestamp,
        updated_at: timestamp,
        finished_at: null,
        ...overrides,
    };
}

function resultRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "task-1",
        tenant_id: "tenant-a",
        task_id: "task-1",
        user_id: "user-a",
        title: "Product presenter",
        cover_uri: "https://cdn.example/presenter.png",
        video_uri: "https://cdn.example/result.mp4",
        storage_scope: "provider",
        width: 0,
        height: 0,
        duration_seconds: 8,
        provider_task_id: "provider-task-1",
        created_at: "2026-08-08T00:01:00.000Z",
        ...overrides,
    };
}

function expectOwnerScope(sql: string) {
    expect(sql).toContain("tenant_id = $1");
    expect(sql).toContain("user_id = $2");
}

describe("ImageHumanRepository", () => {
    it("creates a source-compatible task with a caller-supplied generation task id", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([taskRow()]));
        const repository = new ImageHumanRepository({ query } as unknown as QueryExecutor);

        await expect(
            repository.createTask({
                id: "task-1",
                tenantId: "tenant-a",
                userId: "user-a",
                title: "Product presenter",
                sourceImageUri: "https://cdn.example/presenter.png",
                referenceAudioUri: "https://cdn.example/voice.mp3",
                scriptText: "Hello",
                prompt: "Natural delivery",
                durationSeconds: 8,
                provider: "xhadmin",
            }),
        ).resolves.toMatchObject({
            id: "task-1",
            tenantId: "tenant-a",
            userId: "user-a",
            sourceImageUri: "https://cdn.example/presenter.png",
            referenceAudioUri: "https://cdn.example/voice.mp3",
        });

        const [sql, params] = query.mock.calls[0] as [string, unknown[]];
        expect(sql).toContain("INSERT INTO image_human_tasks");
        expect(params.slice(0, 3)).toEqual(["task-1", "tenant-a", "user-a"]);
    });

    it("isolates task list and task detail queries by tenant and user", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([taskRow()]));
        const repository = new ImageHumanRepository({ query } as unknown as QueryExecutor);

        await repository.listTasks("tenant-a", "user-a", 500);
        await repository.getTask("tenant-a", "user-a", "task-1");

        const [listSql, listParams] = query.mock.calls[0] as [string, unknown[]];
        const [getSql, getParams] = query.mock.calls[1] as [string, unknown[]];
        expectOwnerScope(listSql);
        expectOwnerScope(getSql);
        expect(listParams).toEqual(["tenant-a", "user-a", 100]);
        expect(getParams).toEqual(["tenant-a", "user-a", "task-1"]);
    });

    it("returns runtime input only within the same tenant and user scope", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([taskRow()]));
        const repository = new ImageHumanRepository({ query } as unknown as QueryExecutor);

        await expect(repository.getRuntimeTask("tenant-a", "user-a", "task-1")).resolves.toMatchObject({
            id: "task-1",
            tenantId: "tenant-a",
            userId: "user-a",
            imageUrl: "https://cdn.example/presenter.png",
            audioUrl: "https://cdn.example/voice.mp3",
        });

        const [sql, params] = query.mock.calls[0] as [string, unknown[]];
        expectOwnerScope(sql);
        expect(params).toEqual(["tenant-a", "user-a", "task-1"]);
    });

    it("isolates runtime updates by tenant and user and clamps progress", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([taskRow({ status: "running", progress: 100 })]));
        const repository = new ImageHumanRepository({ query } as unknown as QueryExecutor);

        await repository.updateRuntimeTask("tenant-a", "user-a", "task-1", {
            providerStage: "waiting_provider",
            providerTaskId: "provider-task-1",
            status: "running",
            progress: 120,
        });

        const [sql, params] = query.mock.calls[0] as [string, unknown[]];
        expectOwnerScope(sql);
        expect(params.slice(0, 3)).toEqual(["tenant-a", "user-a", "task-1"]);
        expect(params).toContain(100);
    });

    it("persists a same-id result and completes only the owning user's task", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([taskRow({ status: "success", progress: 100 })]));
        const repository = new ImageHumanRepository({ query } as unknown as QueryExecutor);

        await repository.completeRuntimeTask("tenant-a", "user-a", "task-1", "https://cdn.example/result.mp4", {
            provider: { status: "succeed" },
        });

        const [sql, params] = query.mock.calls[0] as [string, unknown[]];
        expectOwnerScope(sql);
        expect(sql).toContain("INSERT INTO image_human_results");
        expect(sql).toContain("SELECT id, tenant_id, id, user_id");
        expect(params.slice(0, 3)).toEqual(["tenant-a", "user-a", "task-1"]);
    });

    it("fails only the owning user's task and bounds the public error", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([taskRow({ status: "error", error: "x".repeat(500) })]));
        const repository = new ImageHumanRepository({ query } as unknown as QueryExecutor);

        await repository.failRuntimeTask("tenant-a", "user-a", "task-1", "x".repeat(600), { code: "UPSTREAM" });

        const [sql, params] = query.mock.calls[0] as [string, unknown[]];
        expectOwnerScope(sql);
        expect(params.slice(0, 3)).toEqual(["tenant-a", "user-a", "task-1"]);
        expect(params[3]).toBe("x".repeat(500));
    });

    it("lists results only for the owning tenant and user", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([resultRow()]));
        const repository = new ImageHumanRepository({ query } as unknown as QueryExecutor);

        await expect(repository.listResults("tenant-a", "user-a", 0)).resolves.toMatchObject([
            {
                id: "task-1",
                taskId: "task-1",
                tenantId: "tenant-a",
                userId: "user-a",
                videoUri: "https://cdn.example/result.mp4",
            },
        ]);

        const [sql, params] = query.mock.calls[0] as [string, unknown[]];
        expectOwnerScope(sql);
        expect(params).toEqual(["tenant-a", "user-a", 1]);
    });
});
