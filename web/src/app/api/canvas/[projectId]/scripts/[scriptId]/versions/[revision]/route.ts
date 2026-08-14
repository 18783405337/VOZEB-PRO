import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getScriptVersion } from "@/lib/server/canvas-script-service";

type RouteContext = {
    params: { projectId: string; scriptId: string; revision: string };
};

/**
 * GET /api/canvas/[projectId]/scripts/[scriptId]/versions/[revision]
 * 获取特定版本的脚本内容
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
        const { projectId, scriptId, revision } = params;
        const revisionNumber = parseInt(revision);

        if (isNaN(revisionNumber)) {
            return NextResponse.json(
                { code: 400, data: null, msg: "无效的版本号" },
                { status: 400 }
            );
        }

        const version = await getScriptVersion(
            user.id,
            projectId,
            scriptId,
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
        console.error("Failed to get script version:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取版本内容失败" },
            { status: 500 }
        );
    }
}
