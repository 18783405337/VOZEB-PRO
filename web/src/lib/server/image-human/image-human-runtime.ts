import { getAuthSettings } from "@/lib/auth/store";
import { createPostgresRepositories, ensurePostgresSchema } from "@/lib/server/database";
import type { SpecializedTaskRuntimeContext, SpecializedTaskRuntimeStep } from "@/lib/server/digital-human/digital-human-runtime";
import { generationTaskNextPollAt, type GenerationTaskLease } from "@/lib/server/generation-task-scheduler";
import { resolveSpecializedProviderContext } from "@/lib/server/specialized-provider/provider-context";
import {
    sanitizeSpecializedProviderMessage,
    SpecializedProviderError,
    type SpecializedProviderContext,
} from "@/lib/server/specialized-provider/provider-types";

import {
    XhadminImageHumanProvider,
    type ImageHumanProviderRequest,
    type ImageHumanProviderResult,
} from "./xhadmin-image-human-provider";

export type ImageHumanRuntimeTask = Readonly<{
    id: string;
    tenantId: string;
    userId: string;
    imageUrl: string;
    audioUrl: string;
    scriptText: string;
    prompt: string;
    duration: number;
    mode: string;
    providerStage: string;
    providerTaskId: string;
    providerPayload: Record<string, unknown>;
}>;

export type ImageHumanRuntimeTaskPatch = Partial<Pick<ImageHumanRuntimeTask, "providerStage" | "providerTaskId" | "providerPayload">> & {
    status?: "pending" | "running";
    progress?: number;
    error?: string;
};

export type ImageHumanRuntimeProvider = Readonly<{
    protocol: "xhadmin-image-human-v1";
    submit(request: ImageHumanProviderRequest, context: SpecializedProviderContext): Promise<ImageHumanProviderResult>;
    query(taskId: string, context: SpecializedProviderContext): Promise<ImageHumanProviderResult>;
}>;

export type ImageHumanRuntimeDependencies = Readonly<{
    loadTask(tenantId: string, userId: string, taskId: string): Promise<ImageHumanRuntimeTask | null>;
    saveTask(tenantId: string, userId: string, taskId: string, patch: ImageHumanRuntimeTaskPatch): Promise<void>;
    completeTask(tenantId: string, userId: string, taskId: string, videoUrl: string, payload: Record<string, unknown>): Promise<void>;
    failTask(tenantId: string, userId: string, taskId: string, message: string, payload: Record<string, unknown>): Promise<void>;
    resolveContext(lease: GenerationTaskLease, task: ImageHumanRuntimeTask): Promise<SpecializedProviderContext>;
    providerFor(context: SpecializedProviderContext): ImageHumanRuntimeProvider;
    now?(): number;
}>;

export async function runImageHumanTaskStep(
    lease: GenerationTaskLease,
    _context: SpecializedTaskRuntimeContext,
): Promise<SpecializedTaskRuntimeStep> {
    return runImageHumanTaskStepWithDependencies(lease, createDefaultDependencies());
}

export async function runImageHumanTaskStepWithDependencies(
    lease: GenerationTaskLease,
    dependencies: ImageHumanRuntimeDependencies,
): Promise<SpecializedTaskRuntimeStep> {
    const task = await dependencies.loadTask(lease.tenantId, lease.userId, lease.id);
    if (!task) return needsReview("image_human_task_missing");

    let context: SpecializedProviderContext;
    try {
        context = await dependencies.resolveContext(lease, task);
    } catch (error) {
        return needsReview(statusFromError("provider_context_invalid", error));
    }
    if (context.protocol !== "xhadmin-image-human-v1") return needsReview("image_human_provider_protocol_mismatch", context);

    const provider = dependencies.providerFor(context);
    if (provider.protocol !== context.protocol) return needsReview("image_human_provider_protocol_mismatch", context);

    const now = dependencies.now?.() ?? Date.now();
    try {
        if (!task.providerStage || task.providerStage === "queued" || task.providerStage === "submitting") {
            const submission = await provider.submit(providerRequest(task), context);
            const payload = mergePayload(task.providerPayload, { submission: submission.payload });
            await dependencies.saveTask(task.tenantId, task.userId, task.id, {
                providerStage: "waiting_provider",
                providerTaskId: submission.taskId,
                providerPayload: payload,
                status: "running",
                progress: 15,
                error: "",
            });
            return submitted(context, submission.taskId, now);
        }

        if (task.providerStage === "waiting_provider") {
            return pollProvider(lease, task, context, provider, dependencies, now);
        }

        if (task.providerStage === "persisting_result") {
            const videoUrl = text(task.providerPayload.videoUrl);
            if (!videoUrl) return failTask(task, "Generated image human video is missing", task.providerPayload, dependencies, context, now, "result_missing");
            await dependencies.completeTask(task.tenantId, task.userId, task.id, videoUrl, task.providerPayload);
            return {
                state: "completed",
                patch: {
                    executionPhase: "completed",
                    channelId: context.channelId,
                    provider: context.protocol,
                    nextPollAt: undefined,
                    lastUpstreamStatus: "succeeded",
                    resultPayload: { videoUrl },
                },
            };
        }

        return needsReview(`image_human_stage_unknown:${task.providerStage || "empty"}`, context);
    } catch (error) {
        const message = sanitizeSpecializedProviderMessage(error, [context.apiKey]);
        if (error instanceof SpecializedProviderError && error.retryable) {
            return {
                state: "deferred",
                patch: {
                    executionPhase: task.providerStage === "waiting_provider" ? "polling" : "submitting",
                    channelId: context.channelId,
                    provider: context.protocol,
                    nextPollAt: generationTaskNextPollAt({
                        submittedAt: lease.submittedAt,
                        consecutiveErrors: errorCount(lease.lastUpstreamStatus) + 1,
                        now,
                    }),
                    lastPollAt: task.providerStage === "waiting_provider" ? now : undefined,
                    lastUpstreamStatus: `provider_retry:${errorCount(lease.lastUpstreamStatus) + 1}`,
                },
            };
        }
        return needsReview(`provider_error:${message}`, context);
    }
}

async function pollProvider(
    lease: GenerationTaskLease,
    task: ImageHumanRuntimeTask,
    context: SpecializedProviderContext,
    provider: ImageHumanRuntimeProvider,
    dependencies: ImageHumanRuntimeDependencies,
    now: number,
): Promise<SpecializedTaskRuntimeStep> {
    if (!task.providerTaskId) throw new SpecializedProviderError("Provider task ID is missing", "MALFORMED_RESPONSE");
    const result = await provider.query(task.providerTaskId, context);
    const payload = mergePayload(task.providerPayload, { queryResult: result.payload });

    if (result.state === "failed" || result.state === "cancelled") {
        return failTask(task, result.error || `Provider task ${result.state}`, payload, dependencies, context, now, result.state);
    }
    if (result.state === "succeeded") {
        if (!result.mediaUrl) {
            return failTask(task, result.error || "Provider response did not contain a video URL", payload, dependencies, context, now, "result_missing");
        }
        const completedPayload = mergePayload(payload, { videoUrl: result.mediaUrl });
        await dependencies.saveTask(task.tenantId, task.userId, task.id, {
            providerStage: "persisting_result",
            providerPayload: completedPayload,
            status: "running",
            progress: 90,
        });
        return {
            state: "result_ready",
            patch: {
                executionPhase: "result_ready",
                upstreamTaskId: task.providerTaskId,
                channelId: context.channelId,
                provider: context.protocol,
                nextPollAt: now,
                lastPollAt: now,
                lastUpstreamStatus: "provider:succeeded",
                resultPayload: { videoUrl: result.mediaUrl },
            },
        };
    }

    await dependencies.saveTask(task.tenantId, task.userId, task.id, {
        providerStage: "waiting_provider",
        providerPayload: payload,
        status: "running",
        progress: result.state === "running" ? 60 : 35,
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
            lastUpstreamStatus: `provider:${result.state}`,
        },
    };
}

async function failTask(
    task: ImageHumanRuntimeTask,
    message: string,
    payload: Record<string, unknown>,
    dependencies: ImageHumanRuntimeDependencies,
    context: SpecializedProviderContext,
    now: number,
    status: string,
): Promise<SpecializedTaskRuntimeStep> {
    const safeMessage = sanitizeSpecializedProviderMessage(message, [context.apiKey]);
    await dependencies.failTask(task.tenantId, task.userId, task.id, safeMessage, payload);
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

function providerRequest(task: ImageHumanRuntimeTask): ImageHumanProviderRequest {
    return {
        localTaskId: task.id,
        imageUrl: task.imageUrl,
        audioUrl: task.audioUrl,
        scriptText: task.scriptText,
        prompt: task.prompt,
        duration: task.duration,
        mode: task.mode,
        providerParams: task.providerPayload,
    };
}

function submitted(context: SpecializedProviderContext, taskId: string, now: number): SpecializedTaskRuntimeStep {
    return {
        state: "pending",
        patch: {
            executionPhase: "submitted",
            upstreamTaskId: taskId,
            channelId: context.channelId,
            provider: context.protocol,
            submittedAt: now,
            nextPollAt: generationTaskNextPollAt({ submittedAt: now, now }),
            lastUpstreamStatus: "waiting_provider",
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

function mergePayload(current: Record<string, unknown>, patch: Record<string, unknown>) {
    return sanitizePayload({ ...current, ...patch });
}

function sanitizePayload(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (/^(authorization|api[_-]?key|access[_-]?token|secret)$/i.test(key)) return [key, "[redacted]"];
            if (Array.isArray(item)) return [key, item.map((entry) => (record(entry) ? sanitizePayload(entry) : entry))];
            return [key, record(item) ? sanitizePayload(item) : item];
        }),
    );
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

function createDefaultDependencies(): ImageHumanRuntimeDependencies {
    return {
        async loadTask(tenantId, userId, taskId) {
            await ensurePostgresSchema();
            return createPostgresRepositories().imageHuman.getRuntimeTask(tenantId, userId, taskId);
        },
        async saveTask(tenantId, userId, taskId, patch) {
            await ensurePostgresSchema();
            await createPostgresRepositories().imageHuman.updateRuntimeTask(tenantId, userId, taskId, patch);
        },
        async completeTask(tenantId, userId, taskId, videoUrl, payload) {
            await ensurePostgresSchema();
            await createPostgresRepositories().imageHuman.completeRuntimeTask(tenantId, userId, taskId, videoUrl, payload);
        },
        async failTask(tenantId, userId, taskId, message, payload) {
            await ensurePostgresSchema();
            await createPostgresRepositories().imageHuman.failRuntimeTask(tenantId, userId, taskId, message, payload);
        },
        async resolveContext(lease, task) {
            const settings = await getAuthSettings();
            const channel = settings.systemChannels.find((item) => item.id === lease.channelId && item.enabled);
            if (!channel) throw new SpecializedProviderError("Pinned physical channel is unavailable", "MISSING_CREDENTIALS");
            return resolveSpecializedProviderContext(
                {
                    logicalModelId: text(task.providerPayload.logicalModelKey) || "image-human",
                    upstreamModel: text(task.providerPayload.upstreamModel) || "image-human",
                    channelId: channel.id,
                    channel,
                },
                "image-human",
            );
        },
        providerFor(context) {
            if (context.protocol === "xhadmin-image-human-v1") return new XhadminImageHumanProvider();
            throw new SpecializedProviderError("Unsupported image human provider protocol", "APP_PROTOCOL_MISMATCH");
        },
    };
}
