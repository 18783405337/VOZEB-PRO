import { randomUUID } from "node:crypto";

import { apiOk } from "@/app/api/_shared/api-response";
import { actionTransferApiError, requireActionTransferContext } from "@/lib/server/action-transfer/action-transfer-access";
import {
    parseActionTransferTaskInput,
    readActionTransferBody,
} from "@/lib/server/action-transfer/action-transfer-validation";
import { SpecializedProviderBindingService } from "@/lib/server/apps/specialized-provider-binding-service";
import { releaseSpecializedTaskBilling, reserveSpecializedTaskBilling } from "@/lib/server/apps/specialized-task-billing";
import { requireTenantAppRuntime } from "@/lib/server/apps/tenant-app-runtime";
import { createPostgresRepositories } from "@/lib/server/database";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { GENERATION_TASK_RETENTION_MS } from "@/lib/server/generation-task-retention";
import { createStoredGenerationTask } from "@/lib/server/generation-task-store";
import { resolveSpecializedProviderContext } from "@/lib/server/specialized-provider/provider-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireActionTransferContext(request);
        const items = await repository.listTasks(tenantId, user.id);
        return apiOk({ items: items.map(publicTask) });
    } catch (error) {
        return actionTransferApiError(error, "动作迁移任务加载失败", "action-transfer.tasks.list");
    }
}

export async function POST(request: Request) {
    try {
        const { user, tenantId, repository } = await requireActionTransferContext(request);
        const tenantApp = await requireTenantAppRuntime(tenantId, "action-transfer", "video");
        const input = parseActionTransferTaskInput(await readActionTransferBody(request));
        const bindingService = new SpecializedProviderBindingService(createPostgresRepositories().appCenter);
        const candidates = await bindingService.resolveTenantAppProviderCandidates(tenantId, "action-transfer");
        const candidate = candidates[0];
        if (!candidate) throw new Error("Action transfer logical API has no ready provider channel");

        const providerContext = resolveSpecializedProviderContext(candidate, "action-transfer");
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
                referenceImages: input.referenceImages,
                sourceVideo: input.sourceVideo,
                prompt: input.prompt,
                mode: input.mode,
                faceCount: input.faceCount,
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
                "action-transfer",
                {
                    id: task.id,
                    tenantId,
                    userId: user.id,
                    type: "action-transfer",
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
                        mode: input.mode,
                        faceCount: input.faceCount,
                        billingSnapshot: billing.snapshot,
                    },
                    createdAt: now,
                    updatedAt: now,
                },
                GENERATION_TASK_RETENTION_MS,
            );
            await scheduleGenerationTask(
                "action-transfer",
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
                console.warn("Action transfer billing reservation release failed", {
                    taskId,
                    error: releaseError instanceof Error ? releaseError.message : "Unknown billing release error",
                });
            });
            throw error;
        }
    } catch (error) {
        return actionTransferApiError(error, "动作迁移任务创建失败", "action-transfer.tasks.create");
    }
}

function publicTask<T extends { tenantId: string; userId: string }>(item: T): Omit<T, "tenantId" | "userId"> {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
