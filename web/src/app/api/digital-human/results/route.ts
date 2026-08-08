import { apiOk } from "@/app/api/_shared/api-response";
import { digitalHumanApiError, requireDigitalHumanContext } from "@/lib/server/digital-human/digital-human-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireDigitalHumanContext(request);
        const items = await repository.listResults(tenantId, user.id);
        return apiOk({ items: items.map(publicResult) });
    } catch (error) {
        return digitalHumanApiError(error, "数字人结果加载失败", "digital-human.results.list");
    }
}

function publicResult(item: Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof requireDigitalHumanContext>>>["repository"]["listResults"]>>[number]) {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
