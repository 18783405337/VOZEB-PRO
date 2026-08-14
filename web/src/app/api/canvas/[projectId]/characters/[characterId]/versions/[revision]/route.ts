import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    getCharacterVersion,
    characterDocumentError,
} from "@/lib/server/canvas-character-service";

type RouteContext = {
    params: { projectId: string; characterId: string; revision: string };
};

/**
 * GET /api/canvas/[projectId]/characters/[characterId]/versions/[revision]
 * 获取特定版本的角色文档
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
        const { projectId, characterId, revision } = params;
        const revisionNumber = parseInt(revision);

        if (isNaN(revisionNumber) || revisionNumber < 1) {
            return NextResponse.json(
                { code: 400, data: null, msg: "无效的版本号" },
                { status: 400 }
            );
        }

        const version = await getCharacterVersion(
            user.id,
            projectId,
            characterId,
            revisionNumber
        );

        if (!version) {
            return NextResponse.json(
                { code: 404, data: null, msg: "版本不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            code: 0,
            data: { version },
            msg: "OK",
        });
    } catch (error) {
        console.error("Failed to get character version:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取版本失败" },
            { status: 500 }
        );
    }
}
