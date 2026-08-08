import { apiOk } from "@/app/api/_shared/api-response";
import { imageHumanApiError, requireImageHumanContext } from "@/lib/server/image-human/image-human-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireImageHumanContext(request);
        const items = await repository.listResults(tenantId, user.id);
        return apiOk({ items: items.map(publicResult) });
    } catch (error) {
        return imageHumanApiError(error, "图片数字人结果加载失败", "image-human.results.list");
    }
}

function publicResult(
    item: Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof requireImageHumanContext>>>["repository"]["listResults"]>>[number],
) {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
