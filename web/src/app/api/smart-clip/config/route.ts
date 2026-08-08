import { apiOk } from "@/app/api/_shared/api-response";
import { requireSmartClipContext, smartClipApiError } from "@/lib/server/smart-clip/smart-clip-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { tenantId, repository } = await requireSmartClipContext(request);
        const config = await repository.getConfig(tenantId);
        return apiOk({ config, templates: repository.listTemplates() });
    } catch (error) {
        return smartClipApiError(error, "Failed to load smart clip config", "smart-clip.config");
    }
}
