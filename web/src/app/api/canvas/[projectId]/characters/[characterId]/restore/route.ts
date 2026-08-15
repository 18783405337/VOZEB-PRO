import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    restoreCharacterVersion,
    characterDocumentError,
} from "@/lib/server/canvas-character-service";

type RouteContext = {
    params: { projectId: string; characterId: string };
};

/**
 * POST /api/canvas/[projectId]/characters/[characterId]/restore
 * 恢复角色到指定版本
 */
export async function POST(request: Request, { params }: RouteContext) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json(
            { code: 401, data: null, msg: "请先登录" },
            { status: 401 }
        );
    }

    try {
        const { projectId, characterId } = await params;
        const body = await request.json();

        if (!body.revision || typeof body.revision !== "number") {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少有效的 revision 字段" },
                { status: 400 }
            );
        }

        const document = await restoreCharacterVersion(
            user.id,
            projectId,
            characterId,
            body.revision
        );

        return NextResponse.json({
            code: 0,
            data: { document },
            msg: "角色版本已恢复",
        });
    } catch (error) {
        const known = characterDocumentError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }

        console.error("Failed to restore character version:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "恢复版本失败" },
            { status: 500 }
        );
    }
}
