import { apiOk } from "@/app/api/_shared/api-response";
import { actionTransferApiError, requireActionTransferContext } from "@/lib/server/action-transfer/action-transfer-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireActionTransferContext(request);
        const items = await repository.listResults(tenantId, user.id);
        return apiOk({ items: items.map(publicResult) });
    } catch (error) {
        return actionTransferApiError(error, "动作迁移结果加载失败", "action-transfer.results.list");
    }
}

function publicResult(
    item: Awaited<
        ReturnType<NonNullable<Awaited<ReturnType<typeof requireActionTransferContext>>>["repository"]["listResults"]>
    >[number],
) {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
