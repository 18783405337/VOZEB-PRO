import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-session";
import {
    createSkillDocument,
    listSkillDocuments,
    getSkillDocument,
    updateSkillDocument,
    deleteSkillDocument,
    skillDocumentError,
} from "@/lib/server/canvas-skill-service";

type RouteContext = {
    params: {
        projectId: string;
    };
};

/**
 * GET /api/canvas/[projectId]/skills
 * 获取项目的所有技能
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession();
        if (!session?.userId) {
            return NextResponse.json({ error: "未授权" }, { status: 401 });
        }

        const { projectId } = context.params;
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const templateId = searchParams.get("templateId") || undefined;
        const status = searchParams.get("status") || undefined;

        const result = await listSkillDocuments(session.userId, projectId, {
            page,
            limit,
            templateId,
            status,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("List skill documents error:", error);
        const errorResponse = skillDocumentError(error);
        if (errorResponse) {
            return NextResponse.json({ error: errorResponse.message }, { status: errorResponse.status });
        }
        return NextResponse.json({ error: "获取技能列表失败" }, { status: 500 });
    }
}

/**
 * POST /api/canvas/[projectId]/skills
 * 创建新的技能文档
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession();
        if (!session?.userId) {
            return NextResponse.json({ error: "未授权" }, { status: 401 });
        }

        const { projectId } = context.params;
        const body = await request.json();

        const { skillId, templateId, name, parameters } = body;

        if (!skillId || !templateId || !name) {
            return NextResponse.json(
                { error: "缺少必填字段: skillId, templateId, name" },
                { status: 400 }
            );
        }

        const document = await createSkillDocument(session.userId, projectId, {
            skillId,
            templateId,
            name,
            parameters,
        });

        return NextResponse.json(document, { status: 201 });
    } catch (error) {
        console.error("Create skill document error:", error);
        const errorResponse = skillDocumentError(error);
        if (errorResponse) {
            return NextResponse.json({ error: errorResponse.message }, { status: errorResponse.status });
        }
        return NextResponse.json({ error: "创建技能失败" }, { status: 500 });
    }
}
