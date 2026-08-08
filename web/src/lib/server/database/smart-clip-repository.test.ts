import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "./postgres";
import { SmartClipRepository } from "./smart-clip-repository";

function queryResult(rows: Record<string, unknown>[] = []) {
    return { rows, rowCount: rows.length };
}

describe("SmartClipRepository", () => {
    it("exposes the three migrated smart clip templates", () => {
        const repository = new SmartClipRepository({ query: vi.fn() } as unknown as QueryExecutor);

        expect(repository.listTemplates().map((item) => item.clipType)).toEqual(["realman_broadcast", "broadcast_mixcut", "news_mixcut"]);
    });

    it("uses an enabled mock config until a tenant provider is configured", async () => {
        const repository = new SmartClipRepository({ query: vi.fn().mockResolvedValue(queryResult()) } as unknown as QueryExecutor);

        await expect(repository.getConfig("tenant-a")).resolves.toMatchObject({
            tenantId: "tenant-a",
            provider: "mock",
            model: "smart-clip",
            enabled: true,
        });
    });

    it("creates a tenant-scoped pending task through the mock provider", async () => {
        const timestamp = "2026-08-08T00:00:00.000Z";
        const query = vi.fn().mockResolvedValue(
            queryResult([
                {
                    id: "task-1",
                    tenant_id: "tenant-a",
                    user_id: "user-a",
                    clip_type: "realman_broadcast",
                    title: "Demo",
                    materials_json: [],
                    introduce_card_json: {},
                    pack_rules_json: {},
                    process_rules_json: {},
                    struct_layers_json: [],
                    subtitle_json: {},
                    provider_payload: {},
                    status: "pending",
                    provider: "mock",
                    model: "smart-clip",
                    created_at: timestamp,
                    updated_at: timestamp,
                },
            ]),
        );
        const repository = new SmartClipRepository({ query } as unknown as QueryExecutor);

        await expect(
            repository.createTask({
                tenantId: "tenant-a",
                userId: "user-a",
                clipType: "realman_broadcast",
                scene: "realMan",
                styleId: "default",
                title: "Demo",
                videoUri: "https://cdn.example/source.mp4",
                audioUri: "",
                materials: [],
                introduceCard: {},
                packRules: {},
                processRules: {},
                structLayers: [],
                subtitle: {},
                language: "",
                sourceApp: "",
                sourceResultId: "",
                channel: "smart_clip",
                quality: "1",
                ratio: "duration",
                durationSeconds: 60,
                quantity: 1,
            }),
        ).resolves.toMatchObject({ id: "task-1", tenantId: "tenant-a", provider: "mock", status: "pending" });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO smart_clip_tasks"), expect.arrayContaining(["tenant-a", "user-a", "realman_broadcast"]));
        expect(query.mock.calls[0]?.[1]).toHaveLength(23);
    });

    it("estimates the source default per-second cost", () => {
        const repository = new SmartClipRepository({ query: vi.fn() } as unknown as QueryExecutor);

        expect(repository.estimate({ durationSeconds: 60, quantity: 2 })).toEqual({
            durationSeconds: 60,
            quantity: 2,
            tenantCostPoints: 2.4,
            userChargePoints: 2.4,
        });
    });

    it("is exported by the shared repository factory", async () => {
        const { createPostgresRepositories } = await import("./repositories");
        const query = vi.fn().mockResolvedValue(queryResult());

        expect(createPostgresRepositories({ query } as unknown as QueryExecutor).smartClip).toBeInstanceOf(SmartClipRepository);
    });
});
