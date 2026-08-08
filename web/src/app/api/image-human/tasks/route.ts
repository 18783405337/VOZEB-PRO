import { randomUUID } from "node:crypto";

import { apiOk } from "@/app/api/_shared/api-response";
import { SpecializedProviderBindingService } from "@/lib/server/apps/specialized-provider-binding-service";
import { releaseSpecializedTaskBilling, reserveSpecializedTaskBilling } from "@/lib/server/apps/specialized-task-billing";
import { requireTenantAppRuntime } from "@/lib/server/apps/tenant-app-runtime";
import { createPostgresRepositories } from "@/lib/server/database";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { GENERATION_TASK_RETENTION_MS } from "@/lib/server/generation-task-retention";
import { createStoredGenerationTask } from "@/lib/server/generation-task-store";
import { imageHumanApiError, requireImageHumanContext } from "@/lib/server/image-human/image-human-access";
import { parseImageHumanTaskInput, readImageHumanBody } from "@/lib/server/image-human/image-human-validation";
import { resolveSpecializedProviderContext } from "@/lib/server/specialized-provider/provider-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireImageHumanContext(request);
        const items = await repository.listTasks(tenantId, user.id);
        return apiOk({ items: items.map(publicTask) });
    } catch (error) {
        return imageHumanApiError(error, "图片数字人任务加载失败", "image-human.tasks.list");
    }
}

export async function POST(request: Request) {
    try {
        const { user, tenantId, repository } = await requireImageHumanContext(request);
        const tenantApp = await requireTenantAppRuntime(tenantId, "image-human", "video");
        const input = parseImageHumanTaskInput(await readImageHumanBody(request));
        const bindingService = new SpecializedProviderBindingService(createPostgresRepositories().appCenter);
        const candidates = await bindingService.resolveTenantAppProviderCandidates(tenantId, "image-human");
        const candidate = candidates[0];
        if (!candidate) throw new Error("Image human logical API has no ready provider channel");

        const providerContext = resolveSpecializedProviderContext(candidate, "image-human");
        const taskId = randomUUID();
        const billing = await reserveSpecializedTaskBilling({
            tenantId,
            userId: user.id,
            generationTaskId: taskId,
            tenantApp,
            candidate,
            quantity: input.duration,
        });

        try {
            const task = await repository.createTask({
                id: taskId,
                tenantId,
                userId: user.id,
                title: input.title,
                sourceImageUri: input.imageUrl,
                referenceAudioUri: input.audioUrl,
                scriptText: input.scriptText,
                prompt: input.prompt,
                mode: input.mode,
                durationSeconds: input.duration,
                provider: providerContext.protocol,
                model: candidate.logicalModelId,
                providerPayload: {
                    logicalModelKey: candidate.logicalModelId,
                    upstreamModel: candidate.upstreamModel,
                    protocol: providerContext.protocol,
                },
            });
            const now = Date.now();
            await createStoredGenerationTask(
                "image-human",
                {
                    id: task.id,
                    tenantId,
                    userId: user.id,
                    type: "image-human",
                    status: "pending",
                    appKey: tenantApp.appKey,
                    appVersion: tenantApp.version,
                    workflowKey: tenantApp.definition.workflowKey,
                    taskBillingUsage: {
                        saleAmount: billing.saleAmount,
                        costAmount: billing.costAmount,
                    },
                    payload: {
                        taskId: task.id,
                        appKey: tenantApp.appKey,
                        provider: providerContext.protocol,
                        logicalModelKey: candidate.logicalModelId,
                        upstreamModel: candidate.upstreamModel,
                        durationSeconds: input.duration,
                        billingSnapshot: billing.snapshot,
                    },
                    createdAt: now,
                    updatedAt: now,
                },
                GENERATION_TASK_RETENTION_MS,
            );
            await scheduleGenerationTask(
                "image-human",
                task.id,
                {
                    executionPhase: "created",
                    channelId: candidate.channelId,
                    provider: providerContext.protocol,
                    nextPollAt: now,
                    lastUpstreamStatus: "created",
                },
                { tenantId },
            );
            return apiOk({ task: publicTask(task) }, 201);
        } catch (error) {
            await releaseSpecializedTaskBilling({ tenantId, generationTaskId: taskId }).catch((releaseError) => {
                console.warn("Image human billing reservation release failed", {
                    taskId,
                    error: releaseError instanceof Error ? releaseError.message : "Unknown billing release error",
                });
            });
            throw error;
        }
    } catch (error) {
        return imageHumanApiError(error, "图片数字人任务创建失败", "image-human.tasks.create");
    }
}

function publicTask<T extends { tenantId: string; userId: string }>(item: T): Omit<T, "tenantId" | "userId"> {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
