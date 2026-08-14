import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { restoreScriptVersion } from "@/lib/server/canvas-script-service";

type RouteContext = {
    params: { projectId: string; scriptId: string };
};

/**
 * POST /api/canvas/[projectId]/scripts/[scriptId]/restore
 * 恢复脚本到指定版本
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
        const { projectId, scriptId } = params;
        const body = await request.json();

        if (!body.revision || typeof body.revision !== "number") {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少或无效的 revision 字段" },
                { status: 400 }
            );
        }

        const document = await restoreScriptVersion(
            user.id,
            projectId,
            scriptId,
            body.revision
        );

        return NextResponse.json({
            code: 0,
            data: { document },
            msg: `已恢复到版本 ${body.revision}`,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
            return NextResponse.json(
                { code: 404, data: null, msg: "版本不存在" },
                { status: 404 }
            );
        }

        console.error("Failed to restore script version:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "恢复版本失败" },
            { status: 500 }
        );
    }
}
