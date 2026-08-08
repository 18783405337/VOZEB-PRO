import { getAuthSettings } from "@/lib/auth/store";
import { createPostgresRepositories, ensurePostgresSchema } from "@/lib/server/database";
import { generationTaskNextPollAt, type GenerationTaskLease, type GenerationTaskSchedulePatch } from "@/lib/server/generation-task-scheduler";
import { resolveSpecializedProviderContext } from "@/lib/server/specialized-provider/provider-context";
import {
    sanitizeSpecializedProviderMessage,
    SpecializedProviderError,
    type SpecializedProviderContext,
} from "@/lib/server/specialized-provider/provider-types";
import { persistSpecializedVideoResult } from "@/lib/server/specialized-provider/specialized-media-persistence";

import type { DigitalHumanProvider, DigitalHumanProviderRequest, DigitalHumanProviderResult } from "./digital-human-provider";
import { KlingAvatarProvider } from "./kling-avatar-provider";
import { XhadminDigitalHumanProvider } from "./xhadmin-digital-human-provider";

export type SpecializedTaskRuntimeContext = {
    origin: string;
    publicOrigin: string;
    cookie: string;
};

export type SpecializedTaskRuntimeStep = {
    state: "pending" | "result_ready" | "completed" | "failed" | "needs_review" | "deferred";
    patch: GenerationTaskSchedulePatch;
};

export type DigitalHumanRuntimeTask = Readonly<{
    id: string;
    tenantId: string;
    userId: string;
    scriptText: string;
    prompt: string;
    mode: string;
    providerStage: string;
    providerTaskId: string;
    providerPayload: Record<string, unknown>;
    avatarMediaUrl: string;
    voiceMediaUrl: string;
    voiceProviderAssetId: string;
}>;

export type DigitalHumanRuntimeTaskPatch = Partial<Pick<DigitalHumanRuntimeTask, "providerStage" | "providerTaskId" | "providerPayload">> & {
    status?: "pending" | "running";
    progress?: number;
    error?: string;
};

export type DigitalHumanRuntimeDependencies = Readonly<{
    loadTask(tenantId: string, taskId: string): Promise<DigitalHumanRuntimeTask | null>;
    saveTask(tenantId: string, taskId: string, patch: DigitalHumanRuntimeTaskPatch): Promise<void>;
    persistResult(task: DigitalHumanRuntimeTask, videoUrl: string, context: SpecializedProviderContext): Promise<string>;
    completeTask(tenantId: string, taskId: string, videoUrl: string, payload: Record<string, unknown>): Promise<void>;
    failTask(tenantId: string, taskId: string, message: string, payload: Record<string, unknown>): Promise<void>;
    resolveContext(lease: GenerationTaskLease, task: DigitalHumanRuntimeTask): Promise<SpecializedProviderContext>;
    providerFor(context: SpecializedProviderContext): DigitalHumanProvider;
    now?(): number;
}>;

export async function runDigitalHumanTaskStep(lease: GenerationTaskLease, runtimeContext: SpecializedTaskRuntimeContext): Promise<SpecializedTaskRuntimeStep> {
    return runDigitalHumanTaskStepWithDependencies(lease, createDefaultDependencies(runtimeContext));
}

export async function runDigitalHumanTaskStepWithDependencies(
    lease: GenerationTaskLease,
    dependencies: DigitalHumanRuntimeDependencies,
): Promise<SpecializedTaskRuntimeStep> {
    const task = await dependencies.loadTask(lease.tenantId, lease.id);
    if (!task) return needsReview("digital_human_task_missing");

    let context: SpecializedProviderContext;
    try {
        context = await dependencies.resolveContext(lease, task);
    } catch (error) {
        return needsReview(statusFromError("provider_context_invalid", error));
    }

    const provider = dependencies.providerFor(context);
    if (provider.protocol !== context.protocol) return needsReview("digital_human_provider_protocol_mismatch");

    const now = dependencies.now?.() ?? Date.now();
    const request = providerRequest(task);
    try {
        if (context.protocol === "kling-avatar-v1") {
            return runAvatarOnlyStep(lease, task, request, context, provider, dependencies, now);
        }
        return runXhadminStep(lease, task, request, context, provider, dependencies, now);
    } catch (error) {
        const message = sanitizeSpecializedProviderMessage(error, [context.apiKey]);
        if (error instanceof SpecializedProviderError && error.retryable) {
            return {
                state: "deferred",
                patch: {
                    executionPhase: isPollingStage(task.providerStage) ? "polling" : "submitting",
                    channelId: context.channelId,
                    provider: context.protocol,
                    nextPollAt: generationTaskNextPollAt({ submittedAt: lease.submittedAt, consecutiveErrors: errorCount(lease.lastUpstreamStatus) + 1, now }),
                    lastPollAt: isPollingStage(task.providerStage) ? now : undefined,
                    lastUpstreamStatus: `provider_retry:${errorCount(lease.lastUpstreamStatus) + 1}`,
                },
            };
        }
        return needsReview(`provider_error:${message}`, context);
    }
}

async function runXhadminStep(
    lease: GenerationTaskLease,
    task: DigitalHumanRuntimeTask,
    request: DigitalHumanProviderRequest,
    context: SpecializedProviderContext,
    provider: DigitalHumanProvider,
    dependencies: DigitalHumanRuntimeDependencies,
    now: number,
): Promise<SpecializedTaskRuntimeStep> {
    if (!task.providerStage || task.providerStage === "queued" || task.providerStage === "submitting_tts") {
        const submission = await provider.submitTts(request, context);
        const payload = mergePayload(task.providerPayload, { ttsSubmission: submission.payload });
        await dependencies.saveTask(task.tenantId, task.id, {
            providerStage: "waiting_tts",
            providerTaskId: submission.taskId,
            providerPayload: payload,
            status: "running",
            progress: 10,
            error: "",
        });
        return submitted(context, submission.taskId, "waiting_tts", now);
    }

    if (task.providerStage === "waiting_tts") {
        const result = await provider.queryTts(requiredTaskId(task), context);
        if (result.state === "succeeded") {
            if (!result.mediaUrl) return failMalformed(task, result, dependencies, context, now, "tts_result_missing");
            await dependencies.saveTask(task.tenantId, task.id, {
                providerStage: "submitting_avatar",
                providerPayload: mergePayload(task.providerPayload, { ttsResult: result.payload, audioUrl: result.mediaUrl }),
                status: "running",
                progress: 45,
            });
            return immediate(context, "tts_succeeded", now);
        }
        return handleQueryResult(lease, task, result, dependencies, context, now, "waiting_tts");
    }

    if (task.providerStage === "submitting_avatar") {
        const audioUrl = text(task.providerPayload.audioUrl);
        if (!audioUrl) return failTask(task, "Generated speech audio is missing", task.providerPayload, dependencies, context, now, "tts_result_missing");
        return submitAvatar(task, request, audioUrl, context, provider, dependencies, now);
    }

    return finishAvatarStages(lease, task, request, context, provider, dependencies, now);
}

async function runAvatarOnlyStep(
    lease: GenerationTaskLease,
    task: DigitalHumanRuntimeTask,
    request: DigitalHumanProviderRequest,
    context: SpecializedProviderContext,
    provider: DigitalHumanProvider,
    dependencies: DigitalHumanRuntimeDependencies,
    now: number,
): Promise<SpecializedTaskRuntimeStep> {
    if (!task.providerStage || task.providerStage === "queued" || task.providerStage === "submitting_avatar") {
        if (!task.voiceMediaUrl) return failTask(task, "Voice audio is missing", task.providerPayload, dependencies, context, now, "voice_missing");
        return submitAvatar(task, request, task.voiceMediaUrl, context, provider, dependencies, now);
    }
    return finishAvatarStages(lease, task, request, context, provider, dependencies, now);
}

async function submitAvatar(
    task: DigitalHumanRuntimeTask,
    request: DigitalHumanProviderRequest,
    audioUrl: string,
    context: SpecializedProviderContext,
    provider: DigitalHumanProvider,
    dependencies: DigitalHumanRuntimeDependencies,
    now: number,
) {
    const submission = await provider.submitAvatar(request, audioUrl, context);
    await dependencies.saveTask(task.tenantId, task.id, {
        providerStage: "waiting_avatar",
        providerTaskId: submission.taskId,
        providerPayload: mergePayload(task.providerPayload, { avatarSubmission: submission.payload }),
        status: "running",
        progress: 65,
        error: "",
    });
    return submitted(context, submission.taskId, "waiting_avatar", now);
}

async function finishAvatarStages(
    lease: GenerationTaskLease,
    task: DigitalHumanRuntimeTask,
    _request: DigitalHumanProviderRequest,
    context: SpecializedProviderContext,
    provider: DigitalHumanProvider,
    dependencies: DigitalHumanRuntimeDependencies,
    now: number,
): Promise<SpecializedTaskRuntimeStep> {
    if (task.providerStage === "waiting_avatar") {
        const result = await provider.queryAvatar(requiredTaskId(task), context);
        if (result.state === "succeeded") {
            if (!result.mediaUrl) return failMalformed(task, result, dependencies, context, now, "avatar_result_missing");
            const payload = mergePayload(task.providerPayload, { avatarResult: result.payload, videoUrl: result.mediaUrl });
            await dependencies.saveTask(task.tenantId, task.id, {
                providerStage: "persisting_result",
                providerPayload: payload,
                status: "running",
                progress: 90,
            });
            return {
                state: "result_ready",
                patch: {
                    executionPhase: "result_ready",
                    channelId: context.channelId,
                    provider: context.protocol,
                    nextPollAt: now,
                    lastPollAt: now,
                    lastUpstreamStatus: "avatar_succeeded",
                    resultPayload: { videoUrl: result.mediaUrl },
                },
            };
        }
        return handleQueryResult(lease, task, result, dependencies, context, now, "waiting_avatar");
    }

    if (task.providerStage === "persisting_result") {
        const videoUrl = text(task.providerPayload.videoUrl);
        if (!videoUrl) return failTask(task, "Generated avatar video is missing", task.providerPayload, dependencies, context, now, "avatar_result_missing");
        const persistedVideoUrl = await dependencies.persistResult(task, videoUrl, context);
        const payload = mergePayload(task.providerPayload, {
            providerVideoUrl: videoUrl,
            videoUrl: persistedVideoUrl,
        });
        await dependencies.completeTask(task.tenantId, task.id, persistedVideoUrl, payload);
        return {
            state: "completed",
            patch: {
                executionPhase: "completed",
                channelId: context.channelId,
                provider: context.protocol,
                nextPollAt: undefined,
                lastUpstreamStatus: "succeeded",
                resultPayload: { videoUrl: persistedVideoUrl },
            },
        };
    }

    return needsReview(`digital_human_stage_unknown:${task.providerStage || "empty"}`, context);
}

async function handleQueryResult(
    lease: GenerationTaskLease,
    task: DigitalHumanRuntimeTask,
    result: DigitalHumanProviderResult,
    dependencies: DigitalHumanRuntimeDependencies,
    context: SpecializedProviderContext,
    now: number,
    stage: "waiting_tts" | "waiting_avatar",
): Promise<SpecializedTaskRuntimeStep> {
    const payloadKey = stage === "waiting_tts" ? "ttsResult" : "avatarResult";
    const payload = mergePayload(task.providerPayload, { [payloadKey]: result.payload });
    if (result.state === "failed" || result.state === "cancelled") {
        return failTask(task, result.error || `Provider task ${result.state}`, payload, dependencies, context, now, result.state);
    }
    await dependencies.saveTask(task.tenantId, task.id, {
        providerStage: stage,
        providerPayload: payload,
        status: "running",
        progress: stage === "waiting_tts" ? 30 : 75,
    });
    return {
        state: result.state === "unknown" ? "deferred" : "pending",
        patch: {
            executionPhase: "polling",
            upstreamTaskId: task.providerTaskId,
            channelId: context.channelId,
            provider: context.protocol,
            nextPollAt: generationTaskNextPollAt({ submittedAt: lease.submittedAt || now, now }),
            lastPollAt: now,
            lastUpstreamStatus: `${stage}:${result.state}`,
        },
    };
}

async function failMalformed(
    task: DigitalHumanRuntimeTask,
    result: DigitalHumanProviderResult,
    dependencies: DigitalHumanRuntimeDependencies,
    context: SpecializedProviderContext,
    now: number,
    status: string,
) {
    return failTask(task, result.error || "Provider response did not contain a media URL", mergePayload(task.providerPayload, { malformedResult: result.payload }), dependencies, context, now, status);
}

async function failTask(
    task: DigitalHumanRuntimeTask,
    message: string,
    payload: Record<string, unknown>,
    dependencies: DigitalHumanRuntimeDependencies,
    context: SpecializedProviderContext,
    now: number,
    status: string,
): Promise<SpecializedTaskRuntimeStep> {
    const safeMessage = sanitizeSpecializedProviderMessage(message, [context.apiKey]);
    await dependencies.failTask(task.tenantId, task.id, safeMessage, payload);
    return {
        state: "failed",
        patch: {
            executionPhase: "completed",
            channelId: context.channelId,
            provider: context.protocol,
            nextPollAt: undefined,
            lastPollAt: now,
            lastUpstreamStatus: status,
        },
    };
}

function submitted(context: SpecializedProviderContext, taskId: string, status: string, now: number): SpecializedTaskRuntimeStep {
    return {
        state: "pending",
        patch: {
            executionPhase: "submitted",
            upstreamTaskId: taskId,
            channelId: context.channelId,
            provider: context.protocol,
            submittedAt: now,
            nextPollAt: generationTaskNextPollAt({ submittedAt: now, now }),
            lastUpstreamStatus: status,
        },
    };
}

function immediate(context: SpecializedProviderContext, status: string, now: number): SpecializedTaskRuntimeStep {
    return {
        state: "pending",
        patch: {
            executionPhase: "submitting",
            channelId: context.channelId,
            provider: context.protocol,
            nextPollAt: now,
            lastUpstreamStatus: status,
        },
    };
}

function needsReview(status: string, context?: SpecializedProviderContext): SpecializedTaskRuntimeStep {
    return {
        state: "needs_review",
        patch: {
            executionPhase: "needs_review",
            channelId: context?.channelId,
            provider: context?.protocol,
            nextPollAt: undefined,
            lastUpstreamStatus: status.slice(0, 160),
        },
    };
}

function providerRequest(task: DigitalHumanRuntimeTask): DigitalHumanProviderRequest {
    return {
        localTaskId: task.id,
        scriptText: task.scriptText,
        avatar: { mediaUrl: task.avatarMediaUrl },
        voice: { mediaUrl: task.voiceMediaUrl, providerAssetId: task.voiceProviderAssetId || undefined },
        providerParams: {
            ...task.providerPayload,
            prompt: task.prompt,
            mode: task.mode === "standard" ? "std" : task.mode,
        },
    };
}

function requiredTaskId(task: DigitalHumanRuntimeTask) {
    if (!task.providerTaskId) throw new SpecializedProviderError("Provider task ID is missing", "MALFORMED_RESPONSE");
    return task.providerTaskId;
}

function mergePayload(current: Record<string, unknown>, patch: Record<string, unknown>) {
    return sanitizePayload({ ...current, ...patch });
}

function sanitizePayload(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (/^(authorization|api[_-]?key|access[_-]?token|secret)$/i.test(key)) return [key, "[redacted]"];
            if (Array.isArray(item)) return [key, item.map((entry) => (record(entry) ? sanitizePayload(entry as Record<string, unknown>) : entry))];
            return [key, record(item) ? sanitizePayload(item as Record<string, unknown>) : item];
        }),
    );
}

function isPollingStage(stage: string) {
    return stage === "waiting_tts" || stage === "waiting_avatar";
}

function errorCount(status: string | undefined) {
    const match = String(status || "").match(/provider_retry:(\d+)/);
    return match ? Number(match[1]) || 0 : 0;
}

function statusFromError(prefix: string, error: unknown) {
    const code = error instanceof SpecializedProviderError ? error.code.toLowerCase() : "unknown";
    return `${prefix}:${code}`;
}

function record(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function createDefaultDependencies(runtimeContext: SpecializedTaskRuntimeContext): DigitalHumanRuntimeDependencies {
    return {
        async loadTask(tenantId, taskId) {
            await ensurePostgresSchema();
            return createPostgresRepositories().digitalHuman.getRuntimeTask(tenantId, taskId);
        },
        async saveTask(tenantId, taskId, patch) {
            await ensurePostgresSchema();
            await createPostgresRepositories().digitalHuman.updateRuntimeTask(tenantId, taskId, patch);
        },
        async persistResult(task, videoUrl, providerContext) {
            const asset = await persistSpecializedVideoResult({
                tenantId: task.tenantId,
                userId: task.userId,
                taskId: task.id,
                taskType: "digital-human",
                sourceUrl: videoUrl,
                origin: runtimeContext.origin,
                cookie: runtimeContext.cookie,
                title: "Digital human",
                model: providerContext.upstreamModel,
                provider: providerContext.protocol,
            });
            return asset.url;
        },
        async completeTask(tenantId, taskId, videoUrl, payload) {
            await ensurePostgresSchema();
            await createPostgresRepositories().digitalHuman.completeRuntimeTask(tenantId, taskId, videoUrl, payload);
        },
        async failTask(tenantId, taskId, message, payload) {
            await ensurePostgresSchema();
            await createPostgresRepositories().digitalHuman.failRuntimeTask(tenantId, taskId, message, payload);
        },
        async resolveContext(lease, task) {
            const settings = await getAuthSettings();
            const channel = settings.systemChannels.find((item) => item.id === lease.channelId && item.enabled);
            if (!channel) throw new SpecializedProviderError("Pinned physical channel is unavailable", "MISSING_CREDENTIALS");
            return resolveSpecializedProviderContext(
                {
                    logicalModelId: text(task.providerPayload.logicalModelKey) || task.providerPayload.model?.toString() || "digital-human",
                    upstreamModel: text(task.providerPayload.upstreamModel) || "digital-human",
                    channelId: channel.id,
                    channel,
                },
                "aigc-digital-human",
            );
        },
        providerFor(context) {
            if (context.protocol === "xhadmin-digital-human-v1") return new XhadminDigitalHumanProvider();
            if (context.protocol === "kling-avatar-v1") return new KlingAvatarProvider();
            throw new SpecializedProviderError("Unsupported digital human provider protocol", "APP_PROTOCOL_MISMATCH");
        },
    };
}
