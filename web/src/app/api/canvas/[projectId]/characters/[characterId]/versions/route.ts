import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    getCharacterVersions,
    getCharacterVersion,
    restoreCharacterVersion,
    characterDocumentError,
} from "@/lib/server/canvas-character-service";

type RouteContext = {
    params: { projectId: string; characterId: string };
};

/**
 * GET /api/canvas/[projectId]/characters/[characterId]/versions
 * 获取角色版本历史列表
 */
export async function GET(request: Request, { params }: RouteContext) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json(
            { code: 401, data: null, msg: "请先登录" },
            { status: 401 }
        );
    }

    try {
        const { projectId, characterId } = params;
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "20");

        const versions = await getCharacterVersions(
            user.id,
            projectId,
            characterId,
            limit
        );

        return NextResponse.json({
            code: 0,
            data: { versions },
            msg: "OK",
        });
    } catch (error) {
        console.error("Failed to get character versions:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取版本历史失败" },
            { status: 500 }
        );
    }
}
