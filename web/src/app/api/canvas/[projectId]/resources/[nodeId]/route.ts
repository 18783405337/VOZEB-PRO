/**
 * Canvas Project Resource API
 *
 * DELETE /api/canvas/:projectId/resources/:nodeId - 删除项目资源关联
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { deleteProjectResource } from "@/lib/server/canvas-project-resources-store";
import { getCanvasProject } from "@/lib/server/canvas-project-store";

export async function DELETE(request: NextRequest, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = await context.params;

        // 验证项目访问权限
        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const deleted = await deleteProjectResource(projectId, session.userId, nodeId);
        if (!deleted) {
            return NextResponse.json({ error: "资源不存在" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete project resource:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "删除项目资源失败" },
            { status: 500 },
        );
    }
}
