import { apiOk } from "@/app/api/_shared/api-response";
import type { SmartClipTaskRecord } from "@/lib/server/database/smart-clip-repository";
import { requireSmartClipContext, smartClipApiError } from "@/lib/server/smart-clip/smart-clip-access";
import { parseSmartClipTaskInput, readSmartClipBody } from "@/lib/server/smart-clip/smart-clip-validation";
import { createStoredGenerationTask } from "@/lib/server/generation-task-store";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { GENERATION_TASK_RETENTION_MS } from "@/lib/server/generation-task-retention";
import { reserveSmartClipBilling } from "@/lib/server/smart-clip/smart-clip-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireSmartClipContext(request);
        const items = await repository.listTasks(tenantId, user.id);
        return apiOk({ items: items.map(publicTask) });
    } catch (error) {
        return smartClipApiError(error, "Failed to load smart clip tasks", "smart-clip.tasks.list");
    }
}

export async function POST(request: Request) {
    try {
        const { user, tenantId, repository } = await requireSmartClipContext(request);
        const input = parseSmartClipTaskInput(await readSmartClipBody(request));
        const scene = input.clipType === "realman_broadcast" ? "realMan" : input.clipType === "news_mixcut" ? "newsMixCutting" : "oralMixCutting";
        const task = await repository.createTask({ ...input, scene, channel: "smart_clip", tenantId, userId: user.id });
        const estimate = repository.estimate(input);
        await reserveSmartClipBilling({ tenantId, userId: user.id, taskId: task.id, quantity: estimate.quantity, tenantCostPoints: estimate.tenantCostPoints, userChargePoints: estimate.userChargePoints, clipType: task.clipType, provider: task.provider, model: task.model });
        await createStoredGenerationTask("smart-clip", {
            id: task.id,
            tenantId,
            userId: user.id,
            status: "pending",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            smartClipTaskId: task.id,
        }, GENERATION_TASK_RETENTION_MS);
        await scheduleGenerationTask("smart-clip", task.id, { executionPhase: "created", nextPollAt: Date.now(), provider: task.provider }, { tenantId });
        return apiOk({ task: publicTask(task), notice: "Task queued for worker execution." }, 201);
    } catch (error) {
        return smartClipApiError(error, "Failed to create smart clip task", "smart-clip.tasks.create");
    }
}

function publicTask(item: SmartClipTaskRecord) {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
