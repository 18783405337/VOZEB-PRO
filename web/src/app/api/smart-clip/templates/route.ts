import { apiOk } from "@/app/api/_shared/api-response";
import { requireSmartClipContext, smartClipApiError } from "@/lib/server/smart-clip/smart-clip-access";
import type { SmartClipType } from "@/lib/server/database/smart-clip-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { repository } = await requireSmartClipContext(request);
        const clipType = new URL(request.url).searchParams.get("clipType") as SmartClipType | null;
        return apiOk({ items: repository.listTemplates(clipType || undefined) });
    } catch (error) {
        return smartClipApiError(error, "Failed to load smart clip templates", "smart-clip.templates");
    }
}
