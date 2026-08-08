import { describe, expect, it, vi } from "vitest";

import {
    persistSpecializedVideoResultWithDependencies,
    specializedMediaLogId,
    specializedMediaSource,
    type SpecializedPersistedVideo,
} from "./specialized-media-persistence";

describe("specialized media persistence", () => {
    const input = {
        tenantId: "tenant-1",
        userId: "user-1",
        taskId: "task-1",
        taskType: "image-human" as const,
        sourceUrl: "https://cdn.example/result.mp4",
        origin: "http://localhost:3000",
        title: "图片数字人",
        model: "image-human-v1",
    };

    it("persists a provider video and records a tenant-scoped generation log", async () => {
        const stored: SpecializedPersistedVideo = {
            url: "/api/generation-log-assets/permanent/2026/08/08/videos/result.mp4",
            storageKey: "permanent/2026/08/08/videos/result.mp4",
            mimeType: "video/mp4",
            bytes: 24,
        };
        const dependencies = {
            findExisting: vi.fn().mockResolvedValue(null),
            store: vi.fn().mockResolvedValue(stored),
            record: vi.fn().mockResolvedValue(undefined),
        };

        await expect(persistSpecializedVideoResultWithDependencies(input, dependencies)).resolves.toEqual(stored);
        expect(dependencies.store).toHaveBeenCalledWith(input);
        expect(dependencies.record).toHaveBeenCalledWith(
            input,
            stored,
            specializedMediaLogId(input.taskType, input.taskId),
        );
    });

    it("reuses an already registered task asset without downloading it again", async () => {
        const existing: SpecializedPersistedVideo = {
            url: "/api/generation-log-assets/permanent/2026/08/08/videos/existing.mp4",
            storageKey: "permanent/2026/08/08/videos/existing.mp4",
            mimeType: "video/mp4",
            bytes: 48,
        };
        const dependencies = {
            findExisting: vi.fn().mockResolvedValue(existing),
            store: vi.fn(),
            record: vi.fn().mockResolvedValue(undefined),
        };

        await expect(persistSpecializedVideoResultWithDependencies(input, dependencies)).resolves.toEqual(existing);
        expect(dependencies.store).not.toHaveBeenCalled();
        expect(dependencies.record).toHaveBeenCalledWith(
            input,
            existing,
            specializedMediaLogId(input.taskType, input.taskId),
        );
    });

    it("uses a task-type-specific source key so different specialized apps cannot collide", () => {
        expect(specializedMediaSource("digital-human")).toBe("specialized-digital-human");
        expect(specializedMediaSource("image-human")).toBe("specialized-image-human");
        expect(specializedMediaSource("action-transfer")).toBe("specialized-action-transfer");
        expect(specializedMediaLogId("action-transfer", "task-1")).toBe("specialized:action-transfer:task-1");
    });
});
