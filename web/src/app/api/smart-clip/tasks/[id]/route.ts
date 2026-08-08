import { apiOk } from "@/app/api/_shared/api-response";
import { requireSmartClipContext, smartClipApiError } from "@/lib/server/smart-clip/smart-clip-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { user, tenantId, repository } = await requireSmartClipContext(request);
        const { id } = await context.params;
        const task = await repository.getTask(tenantId, user.id, id);
        if (!task) throw new Error("Smart clip task not available");
        const { tenantId: _tenantId, userId: _userId, ...publicTask } = task;
        return apiOk({ task: publicTask });
    } catch (error) {
        return smartClipApiError(error, "Failed to load smart clip task", "smart-clip.tasks.detail");
    }
}
