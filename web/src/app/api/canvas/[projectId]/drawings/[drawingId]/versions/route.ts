import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    getDrawingVersions,
    getDrawingVersion,
} from "@/lib/server/canvas-drawing-service";

type RouteContext = {
    params: { projectId: string; drawingId: string };
};

/**
 * GET /api/canvas/[projectId]/drawings/[drawingId]/versions
 * 获取绘图的版本历史
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
        const { projectId, drawingId } = params;
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "10");

        const versions = await getDrawingVersions(
            user.id,
            projectId,
            drawingId,
            limit
        );

        return NextResponse.json({
            code: 0,
            data: { versions },
            msg: "OK",
        });
    } catch (error) {
        console.error("Failed to get versions:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取版本历史失败" },
            { status: 500 }
        );
    }
}
