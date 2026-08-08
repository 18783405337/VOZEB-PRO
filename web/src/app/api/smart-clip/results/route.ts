import { apiOk } from "@/app/api/_shared/api-response";
import { requireSmartClipContext, smartClipApiError } from "@/lib/server/smart-clip/smart-clip-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireSmartClipContext(request);
        const items = await repository.listResults(tenantId, user.id);
        return apiOk({ items: items.map(({ tenantId: _tenantId, userId: _userId, ...item }) => item) });
    } catch (error) {
        return smartClipApiError(error, "Failed to load smart clip results", "smart-clip.results.list");
    }
}

export async function DELETE(request: Request) {
    try {
        const { user, tenantId, repository } = await requireSmartClipContext(request);
        const id = new URL(request.url).searchParams.get("id")?.trim();
        if (!id) return apiOk({ deleted: false });
        return apiOk({ deleted: await repository.deleteResult(tenantId, user.id, id) });
    } catch (error) {
        return smartClipApiError(error, "Failed to delete smart clip result", "smart-clip.results.delete");
    }
}
