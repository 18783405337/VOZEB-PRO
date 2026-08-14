import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getScriptVersions } from "@/lib/server/canvas-script-service";

type RouteContext = {
    params: { projectId: string; scriptId: string };
};

/**
 * GET /api/canvas/[projectId]/scripts/[scriptId]/versions
 * 获取脚本版本历史
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
        const { projectId, scriptId } = params;
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "10");

        const versions = await getScriptVersions(user.id, projectId, scriptId, limit);

        return NextResponse.json({
            code: 0,
            data: { versions },
            msg: "OK",
        });
    } catch (error) {
        console.error("Failed to get script versions:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取版本历史失败" },
            { status: 500 }
        );
    }
}
