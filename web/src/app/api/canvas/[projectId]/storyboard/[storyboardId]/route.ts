import { NextRequest, NextResponse } from "next/server";
import type { StoryboardData } from "@/app/(user)/canvas/storyboard-types";

/**
 * GET /api/canvas/[projectId]/storyboard/[storyboardId]
 * 获取分镜脚本数据
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { projectId: string; storyboardId: string } }
) {
    try {
        const { projectId, storyboardId } = params;

        // TODO: 验证用户权限

        // TODO: 从数据库查询
        // 1. 查询主表 canvas_storyboard
        // 2. 查询场景表 canvas_storyboard_scene
        // 3. 查询镜头表 canvas_storyboard_shot

        // 临时返回 404 以触发客户端创建新文档
        return NextResponse.json(
            {
                code: -1,
                message: "分镜不存在",
            },
            { status: 404 }
        );
    } catch (error) {
        console.error("[Storyboard API] Get error:", error);
        return NextResponse.json(
            {
                code: -1,
                message: "查询失败",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/canvas/[projectId]/storyboard/[storyboardId]
 * 更新分镜脚本数据
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { projectId: string; storyboardId: string } }
) {
    try {
        const { projectId, storyboardId } = params;
        const body = await request.json();

        const {
            title,
            description,
            scenes,
            shots,
            columnConfig,
            timelineConfig,
            revision,
        } = body as StoryboardData;

        // TODO: 验证用户权限

        // TODO: 更新数据库
        // 1. 更新主表 canvas_storyboard
        // 2. 删除旧的场景和镜头数据
        // 3. 插入新的场景表 canvas_storyboard_scene
        // 4. 插入新的镜头表 canvas_storyboard_shot

        // 临时返回成功
        return NextResponse.json({
            code: 0,
            message: "更新成功",
            data: {
                storyboardId,
                projectId,
                title,
                description,
                scenes,
                shots,
                columnConfig,
                timelineConfig,
                revision: revision + 1,
                updatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("[Storyboard API] Update error:", error);
        return NextResponse.json(
            {
                code: -1,
                message: "更新失败",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/canvas/[projectId]/storyboard/[storyboardId]
 * 删除分镜脚本
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { projectId: string; storyboardId: string } }
) {
    try {
        const { projectId, storyboardId } = params;

        // TODO: 验证用户权限

        // TODO: 从数据库删除
        // 由于设置了 ON DELETE CASCADE，删除主表记录会自动删除关联的场景和镜头

        return NextResponse.json({
            code: 0,
            message: "删除成功",
        });
    } catch (error) {
        console.error("[Storyboard API] Delete error:", error);
        return NextResponse.json(
            {
                code: -1,
                message: "删除失败",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
