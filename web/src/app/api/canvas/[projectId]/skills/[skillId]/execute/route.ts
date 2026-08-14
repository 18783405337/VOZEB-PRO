import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-session";
import {
    getSkillDocument,
    updateSkillDocument,
    recordSkillExecution,
} from "@/lib/server/canvas-skill-service";
import { BUILTIN_SKILL_TEMPLATES } from "@/app/(user)/canvas/skill-types";
import { SkillExecutionEngine } from "@/app/(user)/canvas/utils/canvas-skill-execution";

type RouteContext = {
    params: {
        projectId: string;
        skillId: string;
    };
};

/**
 * POST /api/canvas/[projectId]/skills/[skillId]/execute
 * 执行技能
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession();
        if (!session?.userId) {
            return NextResponse.json({ error: "未授权" }, { status: 401 });
        }

        const { projectId, skillId } = context.params;
        const body = await request.json();
        const { parameters } = body;

        // 获取技能文档
        const document = await getSkillDocument(session.userId, projectId, skillId, false);
        if (!document) {
            return NextResponse.json({ error: "技能文档不存在" }, { status: 404 });
        }

        // 查找模板
        const template = BUILTIN_SKILL_TEMPLATES.find((t) => t.id === document.templateId);
        if (!template) {
            return NextResponse.json({ error: "技能模板不存在" }, { status: 404 });
        }

        // 更新为运行状态
        await updateSkillDocument(session.userId, projectId, skillId, {
            status: "running",
            progress: 0,
            error: null,
        });

        // 执行技能
        const executionContext = {
            userId: session.userId,
            projectId,
            skillId,
            templateId: document.templateId,
            parameters: parameters || document.parameters,
        };

        const result = await SkillExecutionEngine.execute(template, executionContext);

        if (result.success) {
            // 更新为成功状态
            await updateSkillDocument(session.userId, projectId, skillId, {
                status: "success",
                progress: 100,
                output: result.output,
                lastExecutedAt: new Date(),
            });

            // 记录执行历史
            await recordSkillExecution(session.userId, projectId, skillId, {
                status: "success",
                parameters: executionContext.parameters,
                output: result.output,
                executionTimeMs: result.executionTimeMs,
            });

            return NextResponse.json({
                success: true,
                output: result.output,
                executionTimeMs: result.executionTimeMs,
            });
        } else {
            // 更新为错误状态
            await updateSkillDocument(session.userId, projectId, skillId, {
                status: "error",
                progress: 0,
                error: result.error,
                lastExecutedAt: new Date(),
            });

            // 记录执行历史
            await recordSkillExecution(session.userId, projectId, skillId, {
                status: "error",
                parameters: executionContext.parameters,
                error: result.error,
                executionTimeMs: result.executionTimeMs,
            });

            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    executionTimeMs: result.executionTimeMs,
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Execute skill error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "执行技能失败" },
            { status: 500 }
        );
    }
}
