import { apiOk } from "@/app/api/_shared/api-response";
import { digitalHumanApiError, requireDigitalHumanContext } from "@/lib/server/digital-human/digital-human-access";
import { parseDigitalHumanVoiceInput, readDigitalHumanBody } from "@/lib/server/digital-human/digital-human-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireDigitalHumanContext(request);
        const items = await repository.listVoices(tenantId, user.id);
        return apiOk({ items: items.map(publicVoice) });
    } catch (error) {
        return digitalHumanApiError(error, "数字人音色加载失败", "digital-human.voices.list");
    }
}

export async function POST(request: Request) {
    try {
        const { user, tenantId, repository } = await requireDigitalHumanContext(request);
        const body = await readDigitalHumanBody(request);
        const input = parseDigitalHumanVoiceInput(body);
        const voice = await repository.saveVoice({
            ...input,
            tenantId,
            userId: user.id,
        });
        return apiOk({ voice: publicVoice(voice) }, 201);
    } catch (error) {
        return digitalHumanApiError(error, "数字人音色保存失败", "digital-human.voices.save");
    }
}

function publicVoice(item: Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof requireDigitalHumanContext>>>["repository"]["listVoices"]>>[number]) {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
