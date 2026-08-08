import { describe, expect, it, vi } from "vitest";

import type { GenerationTaskLease } from "@/lib/server/generation-task-scheduler";
import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

import type { DigitalHumanProvider } from "./digital-human-provider";
import {
    runDigitalHumanTaskStepWithDependencies,
    type DigitalHumanRuntimeDependencies,
    type DigitalHumanRuntimeTask,
} from "./digital-human-runtime";

const lease: GenerationTaskLease = {
    id: "task-1",
    tenantId: "tenant-1",
    userId: "user-1",
    type: "digital-human",
    status: "pending",
    payload: {},
    executionPhase: "created",
    channelId: "channel-1",
    provider: "xhadmin-digital-human-v1",
    nextPollAt: Date.now(),
};

const context: SpecializedProviderContext = {
    appKey: "aigc-digital-human",
    logicalModelKey: "digital-human",
    upstreamModel: "provider-model",
    channelId: "channel-1",
    baseUrl: "https://provider.example.com",
    apiKey: "secret",
    protocol: "xhadmin-digital-human-v1",
    timeoutMs: 30_000,
};

function task(overrides: Partial<DigitalHumanRuntimeTask> = {}): DigitalHumanRuntimeTask {
    return {
        id: "task-1",
        tenantId: "tenant-1",
        userId: "user-1",
        scriptText: "Hello",
        prompt: "Friendly",
        mode: "standard",
        providerStage: "queued",
        providerTaskId: "",
        providerPayload: {},
        avatarMediaUrl: "https://cdn.example/avatar.mp4",
        voiceMediaUrl: "https://cdn.example/voice.mp3",
        voiceProviderAssetId: "voice-ref",
        ...overrides,
    };
}

function setup(initial: DigitalHumanRuntimeTask, provider: DigitalHumanProvider, resolved = context) {
    let current = initial;
    const dependencies: DigitalHumanRuntimeDependencies = {
        loadTask: vi.fn(async () => current),
        saveTask: vi.fn(async (_tenantId, _taskId, patch) => {
            current = { ...current, ...patch };
        }),
        completeTask: vi.fn(async (_tenantId, _taskId, videoUrl, payload) => {
            current = { ...current, providerStage: "succeeded", providerPayload: payload };
            expect(videoUrl).toBeTruthy();
        }),
        failTask: vi.fn(async (_tenantId, _taskId, message, payload) => {
            current = { ...current, providerStage: "failed", providerPayload: payload };
            expect(message).toBeTruthy();
        }),
        resolveContext: vi.fn(async () => resolved),
        providerFor: vi.fn(() => provider),
        now: () => 1_000,
    };
    return { dependencies, current: () => current };
}

describe("digital human runtime", () => {
    it("runs the original Xhadmin TTS then lipsync state machine", async () => {
        const provider: DigitalHumanProvider = {
            protocol: "xhadmin-digital-human-v1",
            submitTts: vi.fn(async () => ({ taskId: "tts-1", payload: { task_id: "tts-1" } })),
            queryTts: vi.fn(async () => ({ state: "succeeded" as const, mediaUrl: "https://cdn.example/generated.mp3", error: "", payload: { status: "completed" } })),
            submitAvatar: vi.fn(async () => ({ taskId: "video-1", payload: { task_id: "video-1" } })),
            queryAvatar: vi.fn(async () => ({ state: "succeeded" as const, mediaUrl: "https://cdn.example/result.mp4", error: "", payload: { status: "completed" } })),
        };
        const setupResult = setup(task(), provider);

        await expect(runDigitalHumanTaskStepWithDependencies(lease, setupResult.dependencies)).resolves.toMatchObject({
            state: "pending",
            patch: { executionPhase: "submitted", upstreamTaskId: "tts-1", lastUpstreamStatus: "waiting_tts" },
        });
        await runDigitalHumanTaskStepWithDependencies(lease, setupResult.dependencies);
        await runDigitalHumanTaskStepWithDependencies(lease, setupResult.dependencies);
        await runDigitalHumanTaskStepWithDependencies(lease, setupResult.dependencies);
        await expect(runDigitalHumanTaskStepWithDependencies(lease, setupResult.dependencies)).resolves.toMatchObject({
            state: "completed",
            patch: { executionPhase: "completed", lastUpstreamStatus: "succeeded" },
        });

        expect(provider.submitTts).toHaveBeenCalledTimes(1);
        expect(provider.submitAvatar).toHaveBeenCalledWith(expect.anything(), "https://cdn.example/generated.mp3", context);
        expect(setupResult.dependencies.completeTask).toHaveBeenCalledWith("tenant-1", "task-1", "https://cdn.example/result.mp4", expect.objectContaining({ videoUrl: "https://cdn.example/result.mp4" }));
    });

    it("uses the source voice directly for the Kling avatar-only flow", async () => {
        const provider: DigitalHumanProvider = {
            protocol: "kling-avatar-v1",
            submitTts: vi.fn(),
            queryTts: vi.fn(),
            submitAvatar: vi.fn(async () => ({ taskId: "kling-1", payload: { data: { task_id: "kling-1" } } })),
            queryAvatar: vi.fn(async () => ({ state: "running" as const, mediaUrl: "", error: "", payload: { data: { task_status: "processing" } } })),
        };
        const klingContext = { ...context, protocol: "kling-avatar-v1" as const };
        const setupResult = setup(task(), provider, klingContext);

        await expect(runDigitalHumanTaskStepWithDependencies({ ...lease, provider: "kling-avatar-v1" }, setupResult.dependencies)).resolves.toMatchObject({
            state: "pending",
            patch: { executionPhase: "submitted", upstreamTaskId: "kling-1", lastUpstreamStatus: "waiting_avatar" },
        });

        expect(provider.submitTts).not.toHaveBeenCalled();
        expect(provider.submitAvatar).toHaveBeenCalledWith(expect.anything(), "https://cdn.example/voice.mp3", klingContext);
    });

    it("pins an accepted upstream task to the resolved physical channel", async () => {
        const provider: DigitalHumanProvider = {
            protocol: "xhadmin-digital-human-v1",
            submitTts: vi.fn(async () => ({ taskId: "tts-1", payload: {} })),
            queryTts: vi.fn(),
            submitAvatar: vi.fn(),
            queryAvatar: vi.fn(),
        };
        const setupResult = setup(task(), provider);

        const result = await runDigitalHumanTaskStepWithDependencies(lease, setupResult.dependencies);

        expect(result.patch).toMatchObject({
            channelId: "channel-1",
            provider: "xhadmin-digital-human-v1",
            upstreamTaskId: "tts-1",
        });
        expect(JSON.stringify(setupResult.current().providerPayload)).not.toContain("secret");
    });
});
