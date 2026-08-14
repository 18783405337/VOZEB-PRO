import { NextRequest, NextResponse } from "next/server";
import type { StoryboardData } from "@/app/(user)/canvas/storyboard-types";

/**
 * POST /api/canvas/[projectId]/storyboard
 * 创建新的分镜脚本
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const { projectId } = params;
        const body = await request.json();

        const {
            storyboardId,
            title,
            description,
            scenes,
            shots,
            columnConfig,
            timelineConfig,
        } = body as StoryboardData;

        // TODO: 验证用户权限

        // TODO: 保存到数据库
        // 1. 插入主表 canvas_storyboard
        // 2. 插入场景表 canvas_storyboard_scene
        // 3. 插入镜头表 canvas_storyboard_shot

        // 临时返回成功
        return NextResponse.json({
            code: 0,
            message: "创建成功",
            data: {
                storyboardId,
                projectId,
                title,
                description,
                scenes,
                shots,
                columnConfig,
                timelineConfig,
                revision: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("[Storyboard API] Create error:", error);
        return NextResponse.json(
            {
                code: -1,
                message: "创建失败",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
