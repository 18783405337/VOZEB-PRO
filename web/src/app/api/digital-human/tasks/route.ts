import { randomUUID } from "node:crypto";

import { apiOk } from "@/app/api/_shared/api-response";
import { SpecializedProviderBindingService } from "@/lib/server/apps/specialized-provider-binding-service";
import { releaseSpecializedTaskBilling, reserveSpecializedTaskBilling } from "@/lib/server/apps/specialized-task-billing";
import { requireTenantAppRuntime } from "@/lib/server/apps/tenant-app-runtime";
import { createPostgresRepositories } from "@/lib/server/database";
import { digitalHumanApiError, requireDigitalHumanContext } from "@/lib/server/digital-human/digital-human-access";
import { parseDigitalHumanTaskInput, readDigitalHumanBody } from "@/lib/server/digital-human/digital-human-validation";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { GENERATION_TASK_RETENTION_MS } from "@/lib/server/generation-task-retention";
import { createStoredGenerationTask } from "@/lib/server/generation-task-store";
import { resolveSpecializedProviderContext } from "@/lib/server/specialized-provider/provider-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireDigitalHumanContext(request);
        const items = await repository.listTasks(tenantId, user.id);
        return apiOk({ items: items.map(publicTask) });
    } catch (error) {
        return digitalHumanApiError(error, "数字人任务加载失败", "digital-human.tasks.list");
    }
}

export async function POST(request: Request) {
    try {
        const { user, tenantId, repository } = await requireDigitalHumanContext(request);
        const input = parseDigitalHumanTaskInput(await readDigitalHumanBody(request));
        const tenantApp = await requireTenantAppRuntime(tenantId, "aigc-digital-human", "video");
        const bindingService = new SpecializedProviderBindingService(createPostgresRepositories().appCenter);
        const candidates = await bindingService.resolveTenantAppProviderCandidates(tenantId, "aigc-digital-human");
        const candidate = candidates[0];
        if (!candidate) throw new Error("Digital human logical API has no ready provider channel");

        const providerContext = resolveSpecializedProviderContext(candidate, "aigc-digital-human");
        const voice = (await repository.listVoices(tenantId, user.id)).find((item) => item.id === input.voiceId);
        if (!voice) throw new Error("Digital human voice is not available to this user");
        const billingQuantity = Math.max(1, Math.ceil(voice.durationSeconds));
        const taskId = randomUUID();
        const billing = await reserveSpecializedTaskBilling({
            tenantId,
            userId: user.id,
            generationTaskId: taskId,
            tenantApp,
            candidate,
            quantity: billingQuantity,
        });

        try {
            const task = await repository.createTask({
                ...input,
                id: taskId,
                tenantId,
                userId: user.id,
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
                "digital-human",
                {
                    id: task.id,
                    tenantId,
                    userId: user.id,
                    type: "digital-human" as const,
                    status: "pending" as const,
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
                        durationSeconds: billingQuantity,
                        billingSnapshot: billing.snapshot,
                    },
                    createdAt: now,
                    updatedAt: now,
                },
                GENERATION_TASK_RETENTION_MS,
            );
            await scheduleGenerationTask(
                "digital-human",
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
            return apiOk({ task: publicTask(task), notice: "任务已创建，等待数字人供应商处理" }, 201);
        } catch (error) {
            await releaseSpecializedTaskBilling({ tenantId, generationTaskId: taskId }).catch((releaseError) => {
                console.warn("Digital human billing reservation release failed", {
                    taskId,
                    error: releaseError instanceof Error ? releaseError.message : "Unknown billing release error",
                });
            });
            throw error;
        }
    } catch (error) {
        return digitalHumanApiError(error, "数字人任务创建失败", "digital-human.tasks.create");
    }
}

function publicTask(item: Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof requireDigitalHumanContext>>>["repository"]["listTasks"]>>[number]) {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
