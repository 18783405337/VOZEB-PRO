import { apiOk } from "@/app/api/_shared/api-response";
import { digitalHumanApiError, requireDigitalHumanContext } from "@/lib/server/digital-human/digital-human-access";
import { parseDigitalHumanAvatarInput, readDigitalHumanBody } from "@/lib/server/digital-human/digital-human-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { user, tenantId, repository } = await requireDigitalHumanContext(request);
        const items = await repository.listAvatars(tenantId, user.id);
        return apiOk({ items: items.map(publicAvatar) });
    } catch (error) {
        return digitalHumanApiError(error, "数字人形象加载失败", "digital-human.avatars.list");
    }
}

export async function POST(request: Request) {
    try {
        const { user, tenantId, repository } = await requireDigitalHumanContext(request);
        const body = await readDigitalHumanBody(request);
        const input = parseDigitalHumanAvatarInput(body);
        const avatar = await repository.saveAvatar({
            ...input,
            tenantId,
            userId: user.id,
        });
        return apiOk({ avatar: publicAvatar(avatar) }, 201);
    } catch (error) {
        return digitalHumanApiError(error, "数字人形象保存失败", "digital-human.avatars.save");
    }
}

function publicAvatar(item: Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof requireDigitalHumanContext>>>["repository"]["listAvatars"]>>[number]) {
    const { tenantId: _tenantId, userId: _userId, ...publicItem } = item;
    return publicItem;
}
