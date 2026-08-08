import { describe, expect, it, vi } from "vitest";

import type { GenerationTaskLease } from "@/lib/server/generation-task-scheduler";
import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

import {
    runImageHumanTaskStepWithDependencies,
    type ImageHumanRuntimeDependencies,
    type ImageHumanRuntimeProvider,
    type ImageHumanRuntimeTask,
} from "./image-human-runtime";

const lease: GenerationTaskLease = {
    id: "task-1",
    tenantId: "tenant-1",
    userId: "user-1",
    type: "image-human",
    status: "pending",
    payload: {},
    executionPhase: "created",
    channelId: "channel-1",
    provider: "xhadmin-image-human-v1",
    nextPollAt: 1_000,
};

const context: SpecializedProviderContext = {
    appKey: "image-human",
    logicalModelKey: "image-human",
    upstreamModel: "image-human-v1",
    channelId: "channel-1",
    baseUrl: "https://provider.example.com",
    apiKey: "secret",
    protocol: "xhadmin-image-human-v1",
    timeoutMs: 30_000,
};

function task(overrides: Partial<ImageHumanRuntimeTask> = {}): ImageHumanRuntimeTask {
    return {
        id: "task-1",
        tenantId: "tenant-1",
        userId: "user-1",
        imageUrl: "https://cdn.example/avatar.png",
        audioUrl: "https://cdn.example/voice.mp3",
        scriptText: "Hello",
        prompt: "Friendly",
        duration: 12,
        mode: "standard",
        providerStage: "queued",
        providerTaskId: "",
        providerPayload: {},
        ...overrides,
    };
}

function setup(initial: ImageHumanRuntimeTask, provider: ImageHumanRuntimeProvider) {
    let current = initial;
    const dependencies: ImageHumanRuntimeDependencies = {
        loadTask: vi.fn(async () => current),
        saveTask: vi.fn(async (_tenantId, _userId, _taskId, patch) => {
            current = { ...current, ...patch };
        }),
        completeTask: vi.fn(async (_tenantId, _userId, _taskId, videoUrl, payload) => {
            current = { ...current, providerStage: "succeeded", providerPayload: payload };
            expect(videoUrl).toBeTruthy();
        }),
        failTask: vi.fn(async (_tenantId, _userId, _taskId, message, payload) => {
            current = { ...current, providerStage: "failed", providerPayload: payload };
            expect(message).toBeTruthy();
        }),
        resolveContext: vi.fn(async () => context),
        providerFor: vi.fn(() => provider),
        now: () => 1_000,
    };
    return { dependencies, current: () => current };
}

describe("image human runtime", () => {
    it("submits the source-compatible request and pins the upstream task", async () => {
        const provider: ImageHumanRuntimeProvider = {
            protocol: "xhadmin-image-human-v1",
            submit: vi.fn(async () => ({
                taskId: "provider-task-1",
                state: "pending" as const,
                mediaUrl: "",
                error: "",
                payload: { data: { task_id: "provider-task-1" } },
            })),
            query: vi.fn(),
        };
        const result = setup(task(), provider);

        await expect(runImageHumanTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
            state: "pending",
            patch: {
                executionPhase: "submitted",
                upstreamTaskId: "provider-task-1",
                channelId: "channel-1",
                provider: "xhadmin-image-human-v1",
            },
        });
        expect(provider.submit).toHaveBeenCalledWith(
            expect.objectContaining({
                localTaskId: "task-1",
                imageUrl: "https://cdn.example/avatar.png",
                audioUrl: "https://cdn.example/voice.mp3",
                scriptText: "Hello",
                duration: 12,
                mode: "standard",
            }),
            context,
        );
        expect(result.dependencies.saveTask).toHaveBeenCalledWith(
            "tenant-1",
            "user-1",
            "task-1",
            expect.objectContaining({ providerStage: "waiting_provider", providerTaskId: "provider-task-1", progress: 15 }),
        );
        expect(JSON.stringify(result.current().providerPayload)).not.toContain("secret");
    });

    it("keeps polling a running provider task", async () => {
        const provider: ImageHumanRuntimeProvider = {
            protocol: "xhadmin-image-human-v1",
            submit: vi.fn(),
            query: vi.fn(async () => ({
                taskId: "provider-task-1",
                state: "running" as const,
                mediaUrl: "",
                error: "",
                payload: { data: { status: "processing" } },
            })),
        };
        const result = setup(task({ providerStage: "waiting_provider", providerTaskId: "provider-task-1" }), provider);

        await expect(runImageHumanTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
            state: "pending",
            patch: { executionPhase: "polling", upstreamTaskId: "provider-task-1", lastUpstreamStatus: "provider:running" },
        });
        expect(result.dependencies.saveTask).toHaveBeenCalledWith(
            "tenant-1",
            "user-1",
            "task-1",
            expect.objectContaining({ providerStage: "waiting_provider", status: "running", progress: 60 }),
        );
    });

    it("persists a successful provider result before completing", async () => {
        const provider: ImageHumanRuntimeProvider = {
            protocol: "xhadmin-image-human-v1",
            submit: vi.fn(),
            query: vi.fn(async () => ({
                taskId: "provider-task-1",
                state: "succeeded" as const,
                mediaUrl: "https://cdn.example/result.mp4",
                error: "",
                payload: { data: { status: "success" } },
            })),
        };
        const result = setup(task({ providerStage: "waiting_provider", providerTaskId: "provider-task-1" }), provider);

        await expect(runImageHumanTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
            state: "result_ready",
            patch: { executionPhase: "result_ready", resultPayload: { videoUrl: "https://cdn.example/result.mp4" } },
        });
        await expect(runImageHumanTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
            state: "completed",
            patch: { executionPhase: "completed", lastUpstreamStatus: "succeeded" },
        });
        expect(result.dependencies.completeTask).toHaveBeenCalledWith(
            "tenant-1",
            "user-1",
            "task-1",
            "https://cdn.example/result.mp4",
            expect.objectContaining({ videoUrl: "https://cdn.example/result.mp4" }),
        );
    });

    it("marks a failed provider task as terminal", async () => {
        const provider: ImageHumanRuntimeProvider = {
            protocol: "xhadmin-image-human-v1",
            submit: vi.fn(),
            query: vi.fn(async () => ({
                taskId: "provider-task-1",
                state: "failed" as const,
                mediaUrl: "",
                error: "provider rejected request",
                payload: { data: { status: "failed" } },
            })),
        };
        const result = setup(task({ providerStage: "waiting_provider", providerTaskId: "provider-task-1" }), provider);

        await expect(runImageHumanTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
            state: "failed",
            patch: { executionPhase: "completed", lastUpstreamStatus: "failed" },
        });
        expect(result.dependencies.failTask).toHaveBeenCalledWith(
            "tenant-1",
            "user-1",
            "task-1",
            "provider rejected request",
            expect.any(Object),
        );
    });
});
