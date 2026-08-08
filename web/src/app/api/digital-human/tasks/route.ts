import { apiOk } from "@/app/api/_shared/api-response";
import { digitalHumanApiError, requireDigitalHumanContext } from "@/lib/server/digital-human/digital-human-access";
import { parseDigitalHumanTaskInput, readDigitalHumanBody } from "@/lib/server/digital-human/digital-human-validation";
import { createPostgresRepositories } from "@/lib/server/database";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { createStoredGenerationTask } from "@/lib/server/generation-task-store";
import { GENERATION_TASK_RETENTION_MS } from "@/lib/server/generation-task-retention";
import { resolveSpecializedProviderContext } from "@/lib/server/specialized-provider/provider-context";
import { SpecializedProviderBindingService } from "@/lib/server/apps/specialized-provider-binding-service";

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
        const body = await readDigitalHumanBody(request);
        const input = parseDigitalHumanTaskInput(body);
        const bindingService = new SpecializedProviderBindingService(createPostgresRepositories().appCenter);
        const candidates = await bindingService.resolveTenantAppProviderCandidates(tenantId, "aigc-digital-human");
        const candidate = candidates[0];
        if (!candidate) throw new Error("Digital human logical API has no ready provider channel");
        const providerContext = resolveSpecializedProviderContext(candidate, "aigc-digital-human");
        const task = await repository.createTask({
            ...input,
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
                payload: {
                    taskId: task.id,
                    appKey: "aigc-digital-human",
                    provider: providerContext.protocol,
                    logicalModelKey: candidate.logicalModelId,
                    upstreamModel: candidate.upstreamModel,
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
        return apiOk({ task: publicTask(task), notice: "任务已创建，等待数字人供应商适配器接入" }, 201);
    } catch (error) {
        return digitalHumanApiError(error, "数字人任务创建失败", "digital-human.tasks.create");
    }
}

function publicTask(item: Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof requireDigitalHumanContext>>>["repository"]["listTasks"]>>[number]) {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
