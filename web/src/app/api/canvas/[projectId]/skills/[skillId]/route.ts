import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-session";
import {
    getSkillDocument,
    updateSkillDocument,
    deleteSkillDocument,
    getSkillExecutionHistory,
    getSkillStats,
    skillDocumentError,
} from "@/lib/server/canvas-skill-service";

type RouteContext = {
    params: {
        projectId: string;
        skillId: string;
    };
};

/**
 * GET /api/canvas/[projectId]/skills/[skillId]
 * 获取单个技能文档
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession();
        if (!session?.userId) {
            return NextResponse.json({ error: "未授权" }, { status: 401 });
        }

        const { projectId, skillId } = context.params;
        const { searchParams } = new URL(request.url);
        const includeOutput = searchParams.get("includeOutput") !== "false";

        const document = await getSkillDocument(session.userId, projectId, skillId, includeOutput);

        if (!document) {
            return NextResponse.json({ error: "技能文档不存在" }, { status: 404 });
        }

        return NextResponse.json(document);
    } catch (error) {
        console.error("Get skill document error:", error);
        return NextResponse.json({ error: "获取技能失败" }, { status: 500 });
    }
}

/**
 * PATCH /api/canvas/[projectId]/skills/[skillId]
 * 更新技能文档
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession();
        if (!session?.userId) {
            return NextResponse.json({ error: "未授权" }, { status: 401 });
        }

        const { projectId, skillId } = context.params;
        const body = await request.json();

        const document = await updateSkillDocument(session.userId, projectId, skillId, body);

        return NextResponse.json(document);
    } catch (error) {
        console.error("Update skill document error:", error);
        const errorResponse = skillDocumentError(error);
        if (errorResponse) {
            return NextResponse.json({ error: errorResponse.message }, { status: errorResponse.status });
        }
        return NextResponse.json({ error: "更新技能失败" }, { status: 500 });
    }
}

/**
 * DELETE /api/canvas/[projectId]/skills/[skillId]
 * 删除技能文档
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession();
        if (!session?.userId) {
            return NextResponse.json({ error: "未授权" }, { status: 401 });
        }

        const { projectId, skillId } = context.params;

        const success = await deleteSkillDocument(session.userId, projectId, skillId);

        if (!success) {
            return NextResponse.json({ error: "技能文档不存在" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete skill document error:", error);
        return NextResponse.json({ error: "删除技能失败" }, { status: 500 });
    }
}
