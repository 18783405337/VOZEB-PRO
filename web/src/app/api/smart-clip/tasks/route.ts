import { apiOk } from "@/app/api/_shared/api-response";
import type { SmartClipTaskRecord } from "@/lib/server/database/smart-clip-repository";
import { requireSmartClipContext, smartClipApiError } from "@/lib/server/smart-clip/smart-clip-access";
import { parseSmartClipTaskInput, readSmartClipBody } from "@/lib/server/smart-clip/smart-clip-validation";

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
        return apiOk({ task: publicTask(task), notice: "Task created. Provider adapter is pending." }, 201);
    } catch (error) {
        return smartClipApiError(error, "Failed to create smart clip task", "smart-clip.tasks.create");
    }
}

function publicTask(item: SmartClipTaskRecord) {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
