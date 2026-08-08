import { describe, expect, it, vi } from "vitest";

import type { GenerationTaskLease } from "@/lib/server/generation-task-scheduler";
import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

import {
    runActionTransferTaskStepWithDependencies,
    type ActionTransferRuntimeDependencies,
    type ActionTransferRuntimeProvider,
    type ActionTransferRuntimeTask,
} from "./action-transfer-runtime";

const lease: GenerationTaskLease = {
    id: "task-1",
    tenantId: "tenant-1",
    userId: "user-1",
    type: "action-transfer",
    status: "pending",
    payload: {},
    executionPhase: "created",
    channelId: "channel-1",
    provider: "xhadmin-action-transfer-v1",
    nextPollAt: 1_000,
};

const context: SpecializedProviderContext = {
    appKey: "action-transfer",
    logicalModelKey: "action-transfer",
    upstreamModel: "action-transfer-v1",
    channelId: "channel-1",
    baseUrl: "https://provider.example.com",
    apiKey: "secret",
    protocol: "xhadmin-action-transfer-v1",
    timeoutMs: 30_000,
};

function task(overrides: Partial<ActionTransferRuntimeTask> = {}): ActionTransferRuntimeTask {
    return {
        id: "task-1",
        tenantId: "tenant-1",
        userId: "user-1",
        referenceImages: ["https://cdn.example/person.png"],
        sourceVideo: "https://cdn.example/motion.mp4",
        prompt: "Keep camera",
        mode: "standard",
        faceCount: 1,
        durationSeconds: 12,
        providerStage: "queued",
        providerTaskId: "",
        providerPayload: {},
        ...overrides,
    };
}

function setup(initial: ActionTransferRuntimeTask, provider: ActionTransferRuntimeProvider) {
    let current = initial;
    const dependencies: ActionTransferRuntimeDependencies = {
        loadTask: vi.fn(async () => current),
        saveTask: vi.fn(async (_tenantId, _userId, _taskId, patch) => {
            current = { ...current, ...patch };
        }),
        persistResult: vi.fn(async (_task, videoUrl) => videoUrl),
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

describe("action transfer runtime", () => {
    it("submits the original action transfer inputs and pins the provider task", async () => {
        const provider: ActionTransferRuntimeProvider = {
            protocol: "xhadmin-action-transfer-v1",
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

        await expect(runActionTransferTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
            state: "pending",
            patch: {
                executionPhase: "submitted",
                upstreamTaskId: "provider-task-1",
                channelId: "channel-1",
                provider: "xhadmin-action-transfer-v1",
            },
        });
        expect(provider.submit).toHaveBeenCalledWith(
            expect.objectContaining({
                localTaskId: "task-1",
                referenceImageUrls: ["https://cdn.example/person.png"],
                sourceVideoUrl: "https://cdn.example/motion.mp4",
                mode: "standard",
                faceCount: 1,
                duration: 12,
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
        const provider: ActionTransferRuntimeProvider = {
            protocol: "xhadmin-action-transfer-v1",
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

        await expect(runActionTransferTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
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

    it("persists a successful result before completing", async () => {
        const provider: ActionTransferRuntimeProvider = {
            protocol: "xhadmin-action-transfer-v1",
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
        vi.mocked(result.dependencies.persistResult).mockResolvedValue("/api/generation-log-assets/local-result.mp4");

        await expect(runActionTransferTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
            state: "result_ready",
            patch: { executionPhase: "result_ready", resultPayload: { videoUrl: "https://cdn.example/result.mp4" } },
        });
        await expect(runActionTransferTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
            state: "completed",
            patch: {
                executionPhase: "completed",
                lastUpstreamStatus: "succeeded",
                resultPayload: { videoUrl: "/api/generation-log-assets/local-result.mp4" },
            },
        });
        expect(result.dependencies.persistResult).toHaveBeenCalledWith(
            expect.objectContaining({ id: "task-1", tenantId: "tenant-1", userId: "user-1" }),
            "https://cdn.example/result.mp4",
            context,
        );
        expect(result.dependencies.completeTask).toHaveBeenCalledWith(
            "tenant-1",
            "user-1",
            "task-1",
            "/api/generation-log-assets/local-result.mp4",
            expect.objectContaining({
                providerVideoUrl: "https://cdn.example/result.mp4",
                videoUrl: "/api/generation-log-assets/local-result.mp4",
            }),
        );
    });

    it("marks a failed provider task as terminal", async () => {
        const provider: ActionTransferRuntimeProvider = {
            protocol: "xhadmin-action-transfer-v1",
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

        await expect(runActionTransferTaskStepWithDependencies(lease, result.dependencies)).resolves.toMatchObject({
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
