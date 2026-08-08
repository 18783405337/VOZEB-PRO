import { apiOk } from "@/app/api/_shared/api-response";
import { requireSmartClipContext, smartClipApiError } from "@/lib/server/smart-clip/smart-clip-access";
import { parseSmartClipTaskInput, readSmartClipBody } from "@/lib/server/smart-clip/smart-clip-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const { repository } = await requireSmartClipContext(request);
        const input = parseSmartClipTaskInput(await readSmartClipBody(request));
        return apiOk({ estimate: repository.estimate(input) });
    } catch (error) {
        return smartClipApiError(error, "Failed to estimate smart clip", "smart-clip.estimate");
    }
}
