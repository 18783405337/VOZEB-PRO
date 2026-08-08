import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { imageHumanApiError, requireImageHumanContext } from "@/lib/server/image-human/image-human-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { user, tenantId, repository } = await requireImageHumanContext(request);
        const id = (await context.params).id.trim();
        if (!id) return apiError(400, "任务 ID 不能为空");
        const task = await repository.getTask(tenantId, user.id, id);
        if (!task) return apiError(404, "图片数字人任务不存在");
        const { tenantId: _tenantId, userId: _userId, ...publicTask } = task;
        return apiOk({ task: publicTask });
    } catch (error) {
        return imageHumanApiError(error, "图片数字人任务加载失败", "image-human.tasks.detail");
    }
}
