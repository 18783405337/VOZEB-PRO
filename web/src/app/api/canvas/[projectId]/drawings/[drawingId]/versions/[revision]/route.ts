import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDrawingVersion } from "@/lib/server/canvas-drawing-service";

type RouteContext = {
    params: { projectId: string; drawingId: string; revision: string };
};

/**
 * GET /api/canvas/[projectId]/drawings/[drawingId]/versions/[revision]
 * 获取特定版本
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
        const { projectId, drawingId, revision } = params;
        const revisionNum = parseInt(revision);

        if (isNaN(revisionNum)) {
            return NextResponse.json(
                { code: 400, data: null, msg: "无效的版本号" },
                { status: 400 }
            );
        }

        const version = await getDrawingVersion(
            user.id,
            projectId,
            drawingId,
            revisionNum
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
        console.error("Failed to get version:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取版本失败" },
            { status: 500 }
        );
    }
}
