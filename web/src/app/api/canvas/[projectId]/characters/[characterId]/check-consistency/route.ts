import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    checkCharacterConsistency,
    getConsistencyHistory,
    characterDocumentError,
} from "@/lib/server/canvas-character-service";

type RouteContext = {
    params: { projectId: string; characterId: string };
};

/**
 * POST /api/canvas/[projectId]/characters/[characterId]/check-consistency
 * 触发角色一致性检查
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

        if (!body.targetImageUrl) {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少 targetImageUrl 字段" },
                { status: 400 }
            );
        }

        const result = await checkCharacterConsistency(
            user.id,
            projectId,
            characterId,
            {
                targetImageUrl: body.targetImageUrl,
                checkType: body.checkType || "visual_similarity",
                algorithms: body.options?.algorithms || ["phash"],
                threshold: body.options?.threshold,
            }
        );

        return NextResponse.json({
            code: 0,
            data: { checkResult: result },
            msg: "一致性检查已完成",
        });
    } catch (error) {
        const known = characterDocumentError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }

        console.error("Failed to check consistency:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "一致性检查失败" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/canvas/[projectId]/characters/[characterId]/check-consistency
 * 获取角色一致性检查历史
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
        const { projectId, characterId } = await params;
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "20");

        const history = await getConsistencyHistory(
            user.id,
            projectId,
            characterId,
            limit
        );

        return NextResponse.json({
            code: 0,
            data: { history },
            msg: "OK",
        });
    } catch (error) {
        console.error("Failed to get consistency history:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取一致性检查历史失败" },
            { status: 500 }
        );
    }
}
