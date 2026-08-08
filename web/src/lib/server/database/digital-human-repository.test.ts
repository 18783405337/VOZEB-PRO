import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "./postgres";
import { DigitalHumanRepository } from "./digital-human-repository";

function queryResult(rows: Record<string, unknown>[] = []) {
    return { rows, rowCount: rows.length };
}

describe("DigitalHumanRepository", () => {
    it("lists official and current-user avatars inside the requested tenant", async () => {
        const timestamp = "2026-08-08T00:00:00.000Z";
        const query = vi.fn().mockResolvedValue(
            queryResult([
                {
                    id: "avatar-1",
                    tenant_id: "tenant-a",
                    user_id: null,
                    name: "Official",
                    source: "official",
                    gender: "",
                    scene: "",
                    cover_uri: "",
                    media_uri: "https://cdn.example/avatar.png",
                    media_type: "image",
                    storage_scope: "platform",
                    provider: "",
                    provider_asset_id: "",
                    status: "ready",
                    sort_order: 0,
                    created_at: timestamp,
                    updated_at: timestamp,
                },
            ]),
        );
        const repository = new DigitalHumanRepository({ query } as unknown as QueryExecutor);

        await expect(repository.listAvatars("tenant-a", "user-a")).resolves.toMatchObject([{ id: "avatar-1", source: "official", userId: "" }]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("tenant_id = $1"), ["tenant-a", "user-a"]);
    });

    it("does not create a task when either selected asset is outside the tenant or user scope", async () => {
        const query = vi.fn().mockResolvedValue(queryResult());
        const repository = new DigitalHumanRepository({ query } as unknown as QueryExecutor);

        await expect(
            repository.createTask({
                tenantId: "tenant-a",
                userId: "user-a",
                avatarId: "tenant-b-avatar",
                voiceId: "voice-a",
                title: "Demo",
                scriptText: "Hello",
            }),
        ).rejects.toThrow("not available");
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("is exported by the shared repository factory", async () => {
        const { createPostgresRepositories } = await import("./repositories");
        const query = vi.fn().mockResolvedValue(queryResult());

        expect(createPostgresRepositories({ query } as unknown as QueryExecutor).digitalHuman).toBeInstanceOf(DigitalHumanRepository);
    });
});
