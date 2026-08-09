import { randomUUID } from "node:crypto";

import { generationTaskNextPollAt, claimDueGenerationTasks, releaseGenerationTaskLease, renewGenerationTaskLeases, scheduleGenerationTask, type GenerationTaskLease, type GenerationTaskSchedulePatch } from "@/lib/server/generation-task-scheduler";
import { failVideoTaskFromWorker, persistVideoTaskResult, queryVideoTaskUpstream } from "@/lib/server/video-task-runtime";
import { getVideoTask, type VideoTask } from "@/lib/server/video-task-store";
import { createAudioTaskUpstreamStep, markAudioTaskFailed, persistAudioTaskResult, queryAudioTaskUpstreamStep } from "@/lib/server/audio-task-runtime";
import { getAudioTask, updateAudioTask, type AudioTask } from "@/lib/server/audio-task-store";
import { createImageTaskUpstreamStep, markImageTaskFailed, persistImageTaskResult, queryCancelledImageTaskUpstreamStep, queryImageTaskUpstreamStep } from "@/lib/server/image-task-runtime";
import { getImageTask, updateImageTask, type ImageTask } from "@/lib/server/image-task-store";
import { getTextTask, updateTextTask } from "@/lib/server/text-task-store";
import { queryCancelledTextTaskUpstreamStep, runTextTaskStep } from "@/lib/server/text-task-runtime";
import { maintenanceWorkerContext } from "@/lib/server/maintenance-auth";
import { executeAgentRun } from "@/lib/server/agent-run-executor";
import { processAgentRunReview } from "@/lib/server/agent-run-execution";
import { getAgentRun, type AgentRun } from "@/lib/server/agent-run-store";
import { hasCancellableUpstreamTaskId, isCancellationExecutionPhase, requestUpstreamGenerationCancellation, type GenerationCancellationTarget } from "@/lib/server/generation-task-cancellation-service";
import { resolveModelRequestTimeoutMs } from "@/lib/server/model-request-policy";
import { refundAudioTask } from "@/lib/server/audio-task-refund";
import { refundImageTask } from "@/lib/server/image-task-refund";
import { refundTextTask } from "@/lib/server/text-task-refund";
import { refundVideoTask } from "@/lib/server/video-task-refund";
import { GENERATION_TASK_RETENTION_MS } from "@/lib/server/generation-task-retention";
import { transitionStoredGenerationTask } from "@/lib/server/generation-task-store";
import { createPostgresRepositories } from "@/lib/server/database";
import { persistSpecializedVideoResult } from "@/lib/server/specialized-provider/specialized-media-persistence";
import { XhadminSmartClipProvider } from "@/lib/server/smart-clip/xhadmin-smart-clip-provider";
import { runSmartClipTaskStep } from "@/lib/server/smart-clip/smart-clip-runtime";
import { applyGenerationTaskBillingOutcome } from "@/lib/server/billing/generation-task-billing-hook";

type RecoveryResult = "pending" | "result_ready" | "completed" | "failed" | "needs_review" | "deferred";

export async function runGenerationTaskRecoveryBatch(input: { origin: string; publicOrigin?: string; cookie?: string; limit?: number; taskIds?: string[]; workerId?: string; tenantId?: string }) {
    const workerId = input.workerId?.trim().slice(0, 160) || `generation-worker:${process.pid}:${randomUUID()}`;
    const leases = await claimDueGenerationTasks({ workerId, limit: input.limit, taskIds: input.taskIds, leaseMs: 90_000, tenantId: input.tenantId });
    if (!leases.length) return { claimed: 0, pending: 0, resultReady: 0, completed: 0, failed: 0, needsReview: 0, deferred: 0 };

    const heartbeat = setInterval(() => {
        const leasesByTenant = new Map<string, string[]>();
        for (const lease of leases) {
            const tenantId = lease.tenantId || "default";
            const taskIds = leasesByTenant.get(tenantId) || [];
            taskIds.push(lease.id);
            leasesByTenant.set(tenantId, taskIds);
        }
        for (const [tenantId, taskIds] of leasesByTenant) {
            void renewGenerationTaskLeases(workerId, taskIds, 90_000, Date.now(), tenantId).catch((error) =>
                console.error("Generation worker lease heartbeat failed", { workerId, tenantId, error }),
            );
        }
    }, 25_000);
    try {
        const persistence = leases.filter(needsPersistence);
        const queries = leases.filter((lease) => !needsPersistence(lease));
        const results = [
            ...(await runWithConcurrency(queries, 20, (lease) => processGenerationTaskLease(lease, workerId, input.origin, input.publicOrigin || input.origin, input.cookie || ""))),
            ...(await runWithConcurrency(persistence, 4, (lease) => processGenerationTaskLease(lease, workerId, input.origin, input.publicOrigin || input.origin, input.cookie || ""))),
        ];
        return summarize(results);
    } finally {
        clearInterval(heartbeat);
    }
}

async function processGenerationTaskLease(lease: GenerationTaskLease, workerId: string, origin: string, publicOrigin: string, cookie: string): Promise<RecoveryResult> {
    if (lease.status === "cancelled" && isCancellationExecutionPhase(lease.executionPhase)) return processCancelledLease(lease, workerId, origin);
    if (lease.type === "text") return processTextLease(lease, workerId, origin, cookie);
    if (lease.type === "image") return processImageLease(lease, workerId, origin, publicOrigin, cookie);
    if (lease.type === "audio") return processAudioLease(lease, workerId, origin, cookie);
    if (lease.type === "agent") return processAgentLease(lease, workerId, origin, cookie);
    if (lease.type === "digital-human" || lease.type === "image-human" || lease.type === "action-transfer") {
        return processSpecializedLease(lease, workerId, origin, publicOrigin, cookie);
    }
    if (lease.type === "smart-clip") return processSmartClipLease(lease, workerId, origin, publicOrigin, cookie);
    if (lease.type !== "video") {
        await releaseLease(lease, workerId, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "worker_handler_missing" });
        return "needs_review";
    }
    return processVideoLease(lease, workerId, origin, cookie);
}

async function processSmartClipLease(lease: GenerationTaskLease, workerId: string, origin: string, _publicOrigin: string, cookie: string): Promise<RecoveryResult> {
    const repositories = createPostgresRepositories();
    const taskId = typeof lease.payload.smartClipTaskId === "string" ? lease.payload.smartClipTaskId : lease.id;
    const task = await repositories.smartClip.getTask(lease.tenantId, lease.userId, taskId);
    if (!task) {
        await releaseLease(lease, workerId, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "smart_clip_task_missing" });
        return "needs_review";
    }
    const config = await repositories.smartClip.getConfig(lease.tenantId);
    const providerConfig = recordObject(config.config);
    const baseUrl = textValue(providerConfig.baseUrl || providerConfig.base_url);
    const apiKey = textValue(providerConfig.apiKey || providerConfig.api_key);
    if (!config.enabled || config.provider !== "xhadmin" || !baseUrl || !apiKey) {
        await releaseLease(lease, workerId, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "smart_clip_provider_not_configured" });
        return "needs_review";
    }
    try {
        const step = await runSmartClipTaskStep({ ...task, providerPayload: recordObject(task.providerPayload) }, {
            config: { baseUrl, apiKey, timeoutMs: Number(providerConfig.timeoutMs || providerConfig.timeout_ms) || 60_000, submitPath: textValue(providerConfig.submitPath || providerConfig.submit_path), queryPath: textValue(providerConfig.queryPath || providerConfig.query_path) },
            provider: new XhadminSmartClipProvider(),
            saveTask: async (patch) => { await repositories.smartClip.updateTask(lease.tenantId, lease.userId, task.id, patch); },
            persistResult: async (url) => (await persistSpecializedVideoResult({ tenantId: lease.tenantId, userId: lease.userId, taskId: task.id, taskType: "smart-clip", sourceUrl: url, origin, cookie, title: task.title, model: task.model, provider: task.provider })).url,
            completeTask: async (url, payload) => { await repositories.smartClip.createResult({ tenantId: lease.tenantId, userId: lease.userId, taskId: task.id, clipType: task.clipType, styleId: task.styleId, title: task.title, videoUri: url, providerTaskId: task.providerTaskId, result: payload, durationSeconds: task.durationSeconds, costs: task.tenantCostPoints }); },
        });
        if (step.state === "completed" || step.state === "failed") {
            await applyGenerationTaskBillingOutcome({ tenantId: lease.tenantId, generationTaskId: lease.id, outcome: step.state === "completed" ? "success" : "error", sourceEventId: `smart-clip:${lease.id}:${step.state}`, ...(step.state === "completed" ? { billableUsage: { saleAmount: task.userChargePoints, costAmount: task.tenantCostPoints } } : {}) });
            await transitionStoredGenerationTask("smart-clip", lease.id, lease.userId, ["pending", "running"], { status: step.state === "completed" ? "success" : "error" }, GENERATION_TASK_RETENTION_MS, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: step.state === "completed" ? "smart_clip_completed" : "smart_clip_failed", resultPayload: "videoUrl" in step ? { url: step.videoUrl } : {} }, lease.tenantId);
            return step.state;
        }
        await releaseLease(lease, workerId, { executionPhase: task.providerTaskId ? "polling" : "submitted", upstreamTaskId: "providerTaskId" in step ? step.providerTaskId : undefined, provider: config.provider, nextPollAt: "nextPollAt" in step ? step.nextPollAt : generationTaskNextPollAt({ now: Date.now() }), lastUpstreamStatus: "smart_clip_pending" });
        return "pending";
    } catch (error) {
        await releaseLease(lease, workerId, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: `smart_clip_error:${safeError(error)}` });
        return "needs_review";
    }
}

function recordObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function textValue(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

async function processSpecializedLease(lease: GenerationTaskLease, workerId: string, origin: string, publicOrigin: string, cookie: string): Promise<RecoveryResult> {
    const context = { origin, publicOrigin, cookie };
    try {
        const step =
            lease.type === "digital-human"
                ? await (await import("@/lib/server/digital-human/digital-human-runtime")).runDigitalHumanTaskStep(lease, context)
                : lease.type === "image-human"
                  ? await (await import("@/lib/server/image-human/image-human-runtime")).runImageHumanTaskStep(lease, context)
                  : await (await import("@/lib/server/action-transfer/action-transfer-runtime")).runActionTransferTaskStep(lease, context);
        if (step.state === "completed" || step.state === "failed") {
            const transitioned = await transitionStoredGenerationTask(
                lease.type,
                lease.id,
                lease.userId,
                ["pending", "running"],
                { status: step.state === "completed" ? "success" : "error" },
                GENERATION_TASK_RETENTION_MS,
                step.patch,
                lease.tenantId,
            );
            if (transitioned) return step.state;
        }
        await releaseLease(lease, workerId, step.patch);
        return step.state;
    } catch (error) {
        await releaseLease(lease, workerId, {
            executionPhase: "needs_review",
            nextPollAt: undefined,
            lastUpstreamStatus: "specialized_runtime_unavailable",
        });
        console.warn("Specialized generation task runtime unavailable", { taskId: lease.id, type: lease.type, error: safeError(error) });
        return "needs_review";
    }
}

async function processCancelledLease(lease: GenerationTaskLease, workerId: string, origin: string): Promise<RecoveryResult> {
    const target = await cancelledTaskTarget(lease);
    if (!target) {
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "cancelled_task_missing" }, { cancellation: true });
        return "completed";
    }
    const now = Date.now();
    const requestedAt = cancellationRequestedAt(lease, now);
    if (lease.executionPhase === "cancel_requested") {
        if (!hasCancellableUpstreamTaskId(target.upstreamTaskId)) {
            const status = target.executionPhase === "created" ? "cancelled_before_submission" : "cancel_unconfirmed";
            await finishCancelledLease(target, lease, workerId, status);
            return "completed";
        }
        const cancellation = await requestUpstreamGenerationCancellation(target, origin, "", target.userId);
        if (cancellation === "not_submitted") {
            await finishCancelledLease(target, lease, workerId, "cancelled_before_submission");
            return "completed";
        }
        await releaseLease(
            lease,
            workerId,
            {
                executionPhase: "cancel_polling",
                nextPollAt: generationTaskNextPollAt({ submittedAt: requestedAt, now }),
                lastPollAt: now,
                lastUpstreamStatus: cancellation === "accepted" ? "cancel_accepted_polling" : cancellation === "unsupported" ? "cancel_unsupported_polling" : "cancel_deferred_polling",
                resultPayload: { ...lease.resultPayload, cancellationRequestedAt: requestedAt },
            },
            { cancellation: true },
        );
        return cancellation === "deferred" ? "deferred" : "pending";
    }
    if (now - requestedAt >= resolveModelRequestTimeoutMs(target.config, target.type)) {
        await finishCancelledLease(target, lease, workerId, "cancel_unconfirmed");
        return "completed";
    }
    try {
        const status = await queryCancelledUpstream(target, origin);
        if (status.state === "terminal") {
            await finishCancelledLease(target, lease, workerId, `cancelled_upstream_${status.status}`);
            return "completed";
        }
        await releaseLease(
            lease,
            workerId,
            {
                executionPhase: "cancel_polling",
                nextPollAt: generationTaskNextPollAt({ submittedAt: requestedAt, now }),
                lastPollAt: now,
                lastUpstreamStatus: `cancel_polling:${status.status}`,
                resultPayload: { ...lease.resultPayload, cancellationRequestedAt: requestedAt },
            },
            { cancellation: true },
        );
        return "pending";
    } catch (error) {
        const count = errorCount(lease.lastUpstreamStatus) + 1;
        await releaseLease(
            lease,
            workerId,
            {
                executionPhase: "cancel_polling",
                nextPollAt: generationTaskNextPollAt({ submittedAt: requestedAt, consecutiveErrors: count }),
                lastPollAt: now,
                lastUpstreamStatus: `cancel_query_error:${count}`,
                resultPayload: { ...lease.resultPayload, cancellationRequestedAt: requestedAt },
            },
            { cancellation: true },
        );
        console.warn("Cancelled generation task reconciliation deferred", { taskId: lease.id, type: lease.type, error: safeError(error) });
        return "deferred";
    }
}

async function cancelledTaskTarget(lease: GenerationTaskLease): Promise<GenerationCancellationTarget | null> {
    const submissionPhase = cancellationSubmissionPhase(lease);
    if (lease.type === "image") {
        const task = await getImageTask(lease.id, lease.tenantId);
        return task ? { type: "image", taskId: task.id, tenantId: lease.tenantId, userId: task.userId, executionPhase: submissionPhase, upstreamTaskId: task.upstream?.id || lease.upstreamTaskId, queryPath: task.config.advancedConfig?.queryPath, config: task.config } : null;
    }
    if (lease.type === "video") {
        const task = await getVideoTask(lease.id, lease.tenantId);
        return task ? { type: "video", taskId: task.id, tenantId: lease.tenantId, userId: task.userId, executionPhase: submissionPhase, upstreamTaskId: task.upstream.id || lease.upstreamTaskId, queryPath: task.config.advancedConfig?.queryPath, config: task.config } : null;
    }
    if (lease.type === "audio") {
        const task = await getAudioTask(lease.id, lease.tenantId);
        return task ? { type: "audio", taskId: task.id, tenantId: lease.tenantId, userId: task.userId, executionPhase: submissionPhase, upstreamTaskId: task.upstream?.id || lease.upstreamTaskId, queryPath: task.config.advancedConfig?.queryPath, config: task.config } : null;
    }
    if (lease.type === "text") {
        const task = await getTextTask(lease.id, lease.tenantId);
        return task ? { type: "text", taskId: task.id, tenantId: lease.tenantId, userId: task.userId, executionPhase: submissionPhase, upstreamTaskId: task.upstream?.id || lease.upstreamTaskId, queryPath: task.config.advancedConfig?.queryPath, config: task.config } : null;
    }
    return null;
}

async function queryCancelledUpstream(target: GenerationCancellationTarget, origin: string) {
    if (target.type === "image") {
        const task = await getImageTask(target.taskId, target.tenantId);
        return task ? queryCancelledImageTaskUpstreamStep(task, origin, "", target.userId) : { state: "terminal" as const, status: "missing" };
    }
    if (target.type === "video") {
        const task = await getVideoTask(target.taskId, target.tenantId);
        if (!task) return { state: "terminal" as const, status: "missing" };
        const step = await queryVideoTaskUpstream(task, origin, "", target.userId);
        return step.state === "pending" ? { state: "pending" as const, status: step.status } : { state: "terminal" as const, status: step.status };
    }
    if (target.type === "audio") {
        const task = await getAudioTask(target.taskId, target.tenantId);
        if (!task) return { state: "terminal" as const, status: "missing" };
        const step = await queryAudioTaskUpstreamStep(task, origin, "", target.userId);
        return step.state === "pending" ? { state: "pending" as const, status: step.status } : { state: "terminal" as const, status: "status" in step ? step.status : "completed" };
    }
    const task = await getTextTask(target.taskId, target.tenantId);
    return task ? queryCancelledTextTaskUpstreamStep(task, origin, maintenanceWorkerContext(target.userId, target.tenantId)) : { state: "terminal" as const, status: "missing" };
}

async function finishCancelledLease(target: GenerationCancellationTarget, lease: GenerationTaskLease, workerId: string, status: string) {
    if (status !== "cancel_unconfirmed" && status !== "cancelled_task_missing") await refundCancelledTask(target);
    await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastPollAt: Date.now(), lastUpstreamStatus: status }, { cancellation: true });
    await redactCancelledTaskSecret(target).catch((error) => console.warn("Cancelled generation task secret cleanup failed", { taskId: target.taskId, type: target.type, error: safeError(error) }));
}

async function refundCancelledTask(target: GenerationCancellationTarget) {
    if (target.type === "image") {
        const task = await getImageTask(target.taskId, target.tenantId);
        if (task) await refundImageTask(task);
        return;
    }
    if (target.type === "video") {
        const task = await getVideoTask(target.taskId, target.tenantId);
        if (task) await refundVideoTask(task);
        return;
    }
    if (target.type === "audio") {
        const task = await getAudioTask(target.taskId, target.tenantId);
        if (task) await refundAudioTask(task);
        return;
    }
    const task = await getTextTask(target.taskId, target.tenantId);
    if (task) await refundTextTask(task);
}

async function redactCancelledTaskSecret(target: GenerationCancellationTarget) {
    if (target.type === "video") return;
    if (target.type === "image") {
        const task = await getImageTask(target.taskId, target.tenantId);
        if (task) await updateImageTask(target.taskId, { config: { ...task.config, apiKey: "" } }, target.tenantId);
        return;
    }
    if (target.type === "audio") {
        const task = await getAudioTask(target.taskId, target.tenantId);
        if (task) await updateAudioTask(target.taskId, { config: { ...task.config, apiKey: "" } }, target.tenantId);
        return;
    }
    const task = await getTextTask(target.taskId, target.tenantId);
    if (task) await updateTextTask(target.taskId, { config: { ...task.config, apiKey: "" } }, target.tenantId);
}

function cancellationRequestedAt(lease: GenerationTaskLease, fallback: number) {
    const value = Number(lease.resultPayload?.cancellationRequestedAt);
    return Number.isFinite(value) && value > 0 ? value : lease.lastPollAt || lease.submittedAt || fallback;
}

function cancellationSubmissionPhase(lease: GenerationTaskLease) {
    const value = lease.resultPayload?.submissionPhase;
    return value === "created" ? value : undefined;
}

async function processAgentLease(lease: GenerationTaskLease, workerId: string, origin: string, cookie: string): Promise<RecoveryResult> {
    const run = await getAgentRun(lease.id, lease.tenantId);
    if (run?.status === "completed" && !run.reviewed && (lease.executionPhase === "review_pending" || lease.executionPhase === "reviewing")) {
        const result = await processAgentRunReview(run, origin, cookie || maintenanceWorkerContext(run.userId, run.tenantId || lease.tenantId));
        if (result.status === "retry") {
            await releaseLease(lease, workerId, {
                executionPhase: "review_pending",
                nextPollAt: generationTaskNextPollAt({ consecutiveErrors: result.attempts }),
                lastPollAt: Date.now(),
                lastUpstreamStatus: `review_error:${result.attempts}`,
            });
            return "deferred";
        }
        await releaseLease(lease, workerId, {
            executionPhase: result.status === "unavailable" ? "review_unavailable" : "completed",
            nextPollAt: undefined,
            lastUpstreamStatus: result.status === "unavailable" ? "review_unavailable" : "review_completed",
        });
        return "completed";
    }
    if (!run || run.status === "completed" || run.status === "failed" || run.status === "cancelled" || run.status === "paused") {
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: run?.status || "missing" });
        return run?.status === "completed" ? "completed" : "failed";
    }
    try {
        const childTaskIds = pendingAgentChildTaskIds(run);
        if (childTaskIds.length) {
            await runGenerationTaskRecoveryBatch({
                origin,
                cookie: cookie || maintenanceWorkerContext(run.userId, run.tenantId || lease.tenantId),
                limit: childTaskIds.length,
                taskIds: childTaskIds,
                workerId: `${workerId}:children`.slice(0, 160),
                tenantId: run.tenantId || lease.tenantId,
            });
        }
        await executeAgentRun(run, origin, cookie || maintenanceWorkerContext(run.userId, run.tenantId || lease.tenantId));
        const latest = await getAgentRun(run.id, lease.tenantId);
        if (!latest || latest.status === "completed" || latest.status === "failed" || latest.status === "cancelled" || latest.status === "paused") {
            await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: latest?.status || "missing" });
            return latest?.status === "completed" ? "completed" : "failed";
        }
        await releaseLease(lease, workerId, {
            executionPhase: "polling",
            nextPollAt: generationTaskNextPollAt({ submittedAt: lease.submittedAt || run.createdAt }),
            lastPollAt: Date.now(),
            lastUpstreamStatus: latest.status,
        });
        return "pending";
    } catch (error) {
        const latest = await getAgentRun(run.id, lease.tenantId);
        if (latest?.status === "failed") {
            await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "failed" });
            return "failed";
        }
        const count = errorCount(lease.lastUpstreamStatus) + 1;
        await releaseLease(lease, workerId, {
            executionPhase: "polling",
            nextPollAt: generationTaskNextPollAt({ consecutiveErrors: count }),
            lastPollAt: Date.now(),
            lastUpstreamStatus: `query_error:${count}`,
        });
        console.warn("Agent task recovery deferred", { runId: run.id, error: safeError(error) });
        return "deferred";
    }
}

export function pendingAgentChildTaskIds(run: Pick<AgentRun, "tasks">) {
    return Array.from(
        new Set(
            run.tasks.flatMap((task) => {
                if (task.status !== "running") return [];
                if (task.childTasks?.length) return task.childTasks.filter((child) => child.status === "pending").map((child) => child.id);
                return task.taskIds?.length ? task.taskIds : task.taskId ? [task.taskId] : [];
            }),
        ),
    ).slice(0, 50);
}

async function processTextLease(lease: GenerationTaskLease, workerId: string, origin: string, cookie: string): Promise<RecoveryResult> {
    const task = await getTextTask(lease.id, lease.tenantId);
    if (!task || task.status === "success" || task.status === "error" || task.status === "cancelled") {
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined });
        return task?.status === "success" ? "completed" : "failed";
    }
    if (lease.executionPhase === "submitting" && task.status === "running" && !task.upstream?.id) {
        await releaseLease(lease, workerId, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "submission_outcome_unknown" });
        return "needs_review";
    }
    if (!task.upstream?.id)
        await scheduleLease(lease, {
            executionPhase: "submitting",
            channelId: task.config.channelId,
            provider: task.config.advancedConfig?.protocol || task.config.apiFormat,
            queryPath: task.config.advancedConfig?.queryPath,
            nextPollAt: lease.nextPollAt,
            lastUpstreamStatus: "submitting",
        });
    try {
        const step = await runTextTaskStep(task, origin, cookie || maintenanceWorkerContext(task.userId, task.tenantId || lease.tenantId));
        if (step.state === "completed") {
            await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "completed" });
            return "completed";
        }
        if (step.state === "failed") {
            await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "failed" });
            return "failed";
        }
        if (step.state === "needs_review") {
            await releaseLease(lease, workerId, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "submission_outcome_unknown" });
            console.warn("Text task submission needs review", { taskId: task.id, error: step.error });
            return "needs_review";
        }
        const latest = (await getTextTask(task.id, lease.tenantId)) || task;
        const submittedAt = lease.submittedAt || Date.now();
        await releaseLease(lease, workerId, {
            executionPhase: lease.submittedAt ? "polling" : "submitted",
            upstreamTaskId: step.upstreamTaskId,
            channelId: latest.config.channelId,
            provider: latest.config.advancedConfig?.protocol || latest.config.apiFormat,
            queryPath: latest.config.advancedConfig?.queryPath,
            submittedAt,
            nextPollAt: generationTaskNextPollAt({ submittedAt }),
            lastPollAt: Date.now(),
            lastUpstreamStatus: step.status,
        });
        return "pending";
    } catch (error) {
        const latest = await getTextTask(task.id, lease.tenantId);
        const upstreamTaskId = latest?.upstream?.id || lease.upstreamTaskId;
        const count = errorCount(lease.lastUpstreamStatus) + 1;
        await releaseLease(lease, workerId, {
            executionPhase: upstreamTaskId ? "polling" : "needs_review",
            upstreamTaskId,
            nextPollAt: upstreamTaskId ? generationTaskNextPollAt({ submittedAt: lease.submittedAt, consecutiveErrors: count }) : undefined,
            lastPollAt: Date.now(),
            lastUpstreamStatus: upstreamTaskId ? `query_error:${count}` : "submission_outcome_unknown",
        });
        console.warn(upstreamTaskId ? "Text task recovery deferred" : "Text task execution needs review", { taskId: task.id, error: safeError(error) });
        return upstreamTaskId ? "deferred" : "needs_review";
    }
}

async function processImageLease(lease: GenerationTaskLease, workerId: string, origin: string, publicOrigin: string, cookie: string): Promise<RecoveryResult> {
    const task = await getImageTask(lease.id, lease.tenantId);
    if (!task || task.status === "success" || task.status === "cancelled") {
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined });
        return "completed";
    }
    if (lease.executionPhase === "submitting" && !lease.upstreamTaskId && task.status === "running") {
        await releaseLease(lease, workerId, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "submission_outcome_unknown" });
        return "needs_review";
    }
    if (needsPersistence(lease)) return persistImageLease(task, lease, workerId, origin, cookie);
    try {
        const step = task.upstream?.id ? await queryImageTaskUpstreamStep(task, origin, cookie, cookie ? "" : task.userId) : await createImageTaskUpstreamStep(task, origin, publicOrigin, cookie, cookie ? "" : task.userId);
        const now = Date.now();
        if (step.state === "failed") {
            await markImageTaskFailed(task, step.error);
            await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastPollAt: now, lastUpstreamStatus: step.status });
            return "failed";
        }
        if (step.state === "needs_review") {
            const latest = (await getImageTask(task.id, lease.tenantId)) || task;
            await releaseLease(lease, workerId, {
                executionPhase: "needs_review",
                upstreamTaskId: latest.upstream?.id || lease.upstreamTaskId,
                channelId: latest.config.channelId,
                provider: latest.config.advancedConfig?.protocol || latest.config.apiFormat,
                queryPath: latest.config.advancedConfig?.queryPath,
                nextPollAt: undefined,
                lastPollAt: now,
                lastUpstreamStatus: `${step.status}:${step.reason}`.slice(0, 500),
            });
            return "needs_review";
        }
        if (step.state === "completed") {
            await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "persisted" });
            return "completed";
        }
        if (step.state === "result_ready") {
            await releaseLease(lease, workerId, { executionPhase: "result_ready", nextPollAt: now, lastPollAt: now, lastUpstreamStatus: step.status, resultPayload: { url: step.resultUrl } });
            return "result_ready";
        }
        const latest = (await getImageTask(task.id, lease.tenantId)) || task;
        await releaseLease(lease, workerId, {
            executionPhase: latest.upstream?.id ? "polling" : "submitted",
            upstreamTaskId: step.upstream.id,
            channelId: latest.config.channelId,
            provider: latest.config.advancedConfig?.protocol || latest.config.apiFormat,
            queryPath: latest.config.advancedConfig?.queryPath,
            submittedAt: lease.submittedAt || now,
            nextPollAt: generationTaskNextPollAt({ submittedAt: lease.submittedAt || now, now }),
            lastPollAt: latest.upstream?.id ? now : undefined,
            lastUpstreamStatus: step.status,
        });
        return "pending";
    } catch (error) {
        const latest = await getImageTask(task.id, lease.tenantId);
        const count = errorCount(lease.lastUpstreamStatus) + 1;
        const submitted = Boolean(latest?.upstream?.id || lease.upstreamTaskId);
        await releaseLease(lease, workerId, {
            executionPhase: submitted ? "polling" : "needs_review",
            nextPollAt: submitted ? generationTaskNextPollAt({ consecutiveErrors: count }) : undefined,
            lastPollAt: Date.now(),
            lastUpstreamStatus: submitted ? `query_error:${count}` : "submission_outcome_unknown",
        });
        console.warn("Image task step deferred", { taskId: task.id, error: safeError(error) });
        return submitted ? "deferred" : "needs_review";
    }
}

async function persistImageLease(task: ImageTask, lease: GenerationTaskLease, workerId: string, origin: string, cookie: string): Promise<RecoveryResult> {
    const resultUrl = typeof lease.resultPayload?.url === "string" ? lease.resultPayload.url.trim() : "";
    if (!resultUrl) {
        await markImageTaskFailed(task, "图片任务已完成但没有返回图片地址");
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "result_url_missing" });
        return "failed";
    }
    await scheduleLease(lease, { executionPhase: "persisting", nextPollAt: lease.nextPollAt });
    try {
        const completed = await persistImageTaskResult(task, origin, resultUrl, cookie, cookie ? "" : task.userId);
        if (!completed || completed.status !== "success") throw new Error("图片结果保存后未进入成功状态");
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "persisted" });
        return "completed";
    } catch (error) {
        const count = errorCount(lease.lastUpstreamStatus) + 1;
        await releaseLease(lease, workerId, { executionPhase: "persisting", nextPollAt: generationTaskNextPollAt({ consecutiveErrors: count }), lastUpstreamStatus: `persist_error:${count}` });
        console.warn("Image result persistence deferred", { taskId: task.id, error: safeError(error) });
        return "deferred";
    }
}

async function processAudioLease(lease: GenerationTaskLease, workerId: string, origin: string, cookie: string): Promise<RecoveryResult> {
    const task = await getAudioTask(lease.id, lease.tenantId);
    if (!task || task.status === "success" || task.status === "cancelled") {
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined });
        return "completed";
    }
    if (lease.executionPhase === "submitting" && !lease.upstreamTaskId && task.status === "running") {
        await releaseLease(lease, workerId, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "submission_outcome_unknown" });
        return "needs_review";
    }
    if (needsPersistence(lease)) return persistAudioLease(task, lease, workerId, origin, cookie);
    try {
        const step = task.upstream?.id ? await queryAudioTaskUpstreamStep(task, origin, cookie, cookie ? "" : task.userId) : await createAudioTaskUpstreamStep(task, origin, cookie, cookie ? "" : task.userId);
        const now = Date.now();
        if (step.state === "failed") {
            await markAudioTaskFailed(task, step.error);
            await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastPollAt: now, lastUpstreamStatus: step.status });
            return "failed";
        }
        if (step.state === "completed") {
            await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "persisted" });
            return "completed";
        }
        if (step.state === "result_ready") {
            await releaseLease(lease, workerId, { executionPhase: "result_ready", nextPollAt: now, lastPollAt: now, lastUpstreamStatus: step.status, resultPayload: { url: step.resultUrl } });
            return "result_ready";
        }
        const latest = (await getAudioTask(task.id, lease.tenantId)) || task;
        await releaseLease(lease, workerId, {
            executionPhase: latest.upstream?.id ? "polling" : "submitted",
            upstreamTaskId: step.upstreamTaskId,
            channelId: latest.config.channelId,
            provider: latest.config.advancedConfig?.protocol || latest.config.apiFormat,
            queryPath: latest.config.advancedConfig?.queryPath || step.createPath,
            submittedAt: lease.submittedAt || now,
            nextPollAt: generationTaskNextPollAt({ submittedAt: lease.submittedAt || now, now }),
            lastPollAt: latest.upstream?.id ? now : undefined,
            lastUpstreamStatus: step.status,
        });
        return "pending";
    } catch {
        const count = errorCount(lease.lastUpstreamStatus) + 1;
        await releaseLease(lease, workerId, {
            executionPhase: task.upstream?.id ? "polling" : "needs_review",
            nextPollAt: task.upstream?.id ? generationTaskNextPollAt({ consecutiveErrors: count }) : undefined,
            lastPollAt: Date.now(),
            lastUpstreamStatus: task.upstream?.id ? `query_error:${count}` : "submission_outcome_unknown",
        });
        return task.upstream?.id ? "deferred" : "needs_review";
    }
}

async function persistAudioLease(task: AudioTask, lease: GenerationTaskLease, workerId: string, origin: string, cookie: string): Promise<RecoveryResult> {
    const resultUrl = typeof lease.resultPayload?.url === "string" ? lease.resultPayload.url.trim() : "";
    if (!resultUrl) {
        await markAudioTaskFailed(task, "音频任务已完成但没有返回音频地址");
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "result_url_missing" });
        return "failed";
    }
    await scheduleLease(lease, { executionPhase: "persisting", nextPollAt: lease.nextPollAt });
    try {
        const completed = await persistAudioTaskResult(task, origin, resultUrl, cookie, cookie ? "" : task.userId);
        if (!completed || completed.status !== "success") throw new Error("音频结果保存后未进入成功状态");
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "persisted" });
        return "completed";
    } catch (error) {
        const count = errorCount(lease.lastUpstreamStatus) + 1;
        await releaseLease(lease, workerId, { executionPhase: "persisting", nextPollAt: generationTaskNextPollAt({ consecutiveErrors: count }), lastUpstreamStatus: `persist_error:${count}` });
        console.warn("Audio result persistence deferred", { taskId: task.id, error: safeError(error) });
        return "deferred";
    }
}

async function processVideoLease(lease: GenerationTaskLease, workerId: string, origin: string, cookie: string): Promise<RecoveryResult> {
    const task = await getVideoTask(lease.id, lease.tenantId);
    if (!task || task.status === "success" || task.status === "cancelled") {
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined });
        return "completed";
    }
    if (lease.executionPhase === "submitting" && !lease.upstreamTaskId) {
        await releaseLease(lease, workerId, { executionPhase: "needs_review", nextPollAt: undefined, lastUpstreamStatus: "submission_outcome_unknown" });
        return "needs_review";
    }
    if (needsPersistence(lease)) return persistVideoLease(task, lease, workerId, origin, cookie);

    try {
        const step = await queryVideoTaskUpstream(task, origin, cookie, cookie ? "" : task.userId);
        const now = Date.now();
        if (step.state === "failed") {
            await failVideoTaskFromWorker(task, step.error, true);
            await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastPollAt: now, lastUpstreamStatus: step.status });
            return "failed";
        }
        if (step.state === "result_ready") {
            await releaseLease(lease, workerId, {
                executionPhase: "result_ready",
                nextPollAt: now,
                lastPollAt: now,
                lastUpstreamStatus: step.status,
                resultPayload: { url: step.resultUrl },
            });
            return "result_ready";
        }
        await releaseLease(lease, workerId, {
            executionPhase: "polling",
            nextPollAt: generationTaskNextPollAt({ submittedAt: lease.submittedAt, now }),
            lastPollAt: now,
            lastUpstreamStatus: step.status,
        });
        return "pending";
    } catch (error) {
        const count = errorCount(lease.lastUpstreamStatus) + 1;
        await releaseLease(lease, workerId, {
            executionPhase: "polling",
            nextPollAt: generationTaskNextPollAt({ submittedAt: lease.submittedAt, consecutiveErrors: count }),
            lastPollAt: Date.now(),
            lastUpstreamStatus: `query_error:${count}`,
        });
        console.warn("Video task query deferred", { taskId: task.id, error: safeError(error) });
        return "deferred";
    }
}

async function releaseLease(
    lease: GenerationTaskLease,
    workerId: string,
    patch: GenerationTaskSchedulePatch,
    options: { cancellation?: boolean } = {},
) {
    return releaseGenerationTaskLease(lease.type, lease.id, workerId, patch, { ...options, tenantId: lease.tenantId });
}

async function scheduleLease(lease: GenerationTaskLease, patch: GenerationTaskSchedulePatch) {
    return scheduleGenerationTask(lease.type, lease.id, patch, { tenantId: lease.tenantId });
}

async function persistVideoLease(task: VideoTask, lease: GenerationTaskLease, workerId: string, origin: string, cookie: string): Promise<RecoveryResult> {
    const resultUrl = typeof lease.resultPayload?.url === "string" ? lease.resultPayload.url.trim() : "";
    if (!resultUrl) {
        await failVideoTaskFromWorker(task, "视频任务已完成但没有返回视频地址");
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "result_url_missing" });
        return "failed";
    }
    await scheduleLease(lease, { executionPhase: "persisting", nextPollAt: lease.nextPollAt });
    try {
        const completed = await persistVideoTaskResult(task, resultUrl, origin, cookie, cookie ? "" : task.userId);
        if (!completed || completed.status !== "success") throw new Error("视频结果保存后未进入成功状态");
        await releaseLease(lease, workerId, { executionPhase: "completed", nextPollAt: undefined, lastUpstreamStatus: "persisted" });
        return "completed";
    } catch (error) {
        const count = errorCount(lease.lastUpstreamStatus) + 1;
        await releaseLease(lease, workerId, {
            executionPhase: "persisting",
            nextPollAt: generationTaskNextPollAt({ consecutiveErrors: count }),
            lastUpstreamStatus: `persist_error:${count}`,
        });
        console.warn("Video result persistence deferred", { taskId: task.id, error: safeError(error) });
        return "deferred";
    }
}

function needsPersistence(lease: GenerationTaskLease) {
    return lease.executionPhase === "result_ready" || lease.executionPhase === "persisting";
}

async function runWithConcurrency<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>) {
    const results: R[] = [];
    let cursor = 0;
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (cursor < items.length) {
                const index = cursor++;
                results[index] = await run(items[index]);
            }
        }),
    );
    return results;
}

function summarize(results: RecoveryResult[]) {
    return {
        claimed: results.length,
        pending: results.filter((item) => item === "pending").length,
        resultReady: results.filter((item) => item === "result_ready").length,
        completed: results.filter((item) => item === "completed").length,
        failed: results.filter((item) => item === "failed").length,
        needsReview: results.filter((item) => item === "needs_review").length,
        deferred: results.filter((item) => item === "deferred").length,
    };
}

function errorCount(status?: string) {
    const count = Number(status?.match(/(?:query|persist|cancel_query)_error:(\d+)/)?.[1] || 0);
    return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function safeError(error: unknown) {
    return error instanceof Error ? error.message.slice(0, 300) : "unknown";
}
