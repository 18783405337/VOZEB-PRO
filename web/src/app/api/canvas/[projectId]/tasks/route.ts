/**
 * Canvas Task Nodes API
 *
 * GET /api/canvas/:projectId/tasks - 列出所有任务节点
 * GET /api/canvas/:projectId/tasks/:nodeId - 获取 Task 节点
 * POST /api/canvas/:projectId/tasks - 创建 Task 节点
 * PATCH /api/canvas/:projectId/tasks/:nodeId - 更新 Task 节点
 * DELETE /api/canvas/:projectId/tasks/:nodeId - 删除 Task 节点
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import {
    createTaskNode,
    getTaskNode,
    updateTaskNode,
    deleteTaskNode,
    listTaskNodes,
} from "@/lib/server/canvas-project-resources-store";
import { getCanvasProject } from "@/lib/server/canvas-project-store";
import type { CreateCanvasTaskInput, UpdateCanvasTaskInput } from "@/lib/canvas-project-resources-contract";

export async function GET(request: NextRequest, context: { params: { projectId: string; nodeId?: string } }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = await context.params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || undefined;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        if (nodeId) {
            const task = await getTaskNode(projectId, nodeId);
            if (!task) {
                return NextResponse.json({ error: "Task 节点不存在" }, { status: 404 });
            }
            return NextResponse.json(task);
        }

        const tasks = await listTaskNodes(projectId, session.userId, status);
        return NextResponse.json({ tasks });
    } catch (error) {
        console.error("Failed to get task node(s):", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "获取 Task 节点失败" },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
    try {
        const session = await requireSession(request);
        const { projectId } = await context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const body = await request.json();
        const input: CreateCanvasTaskInput = {
            nodeId: body.nodeId,
            taskType: body.taskType,
            status: body.status,
            dependencies: body.dependencies,
            maxAttempts: body.maxAttempts,
        };

        const task = await createTaskNode(projectId, session.userId, input);
        return NextResponse.json(task);
    } catch (error) {
        console.error("Failed to create task node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "创建 Task 节点失败" },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = await context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const body = await request.json();
        const input: UpdateCanvasTaskInput = body;

        const task = await updateTaskNode(projectId, nodeId, input);
        return NextResponse.json(task);
    } catch (error) {
        console.error("Failed to update task node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "更新 Task 节点失败" },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = await context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const deleted = await deleteTaskNode(projectId, nodeId);
        if (!deleted) {
            return NextResponse.json({ error: "Task 节点不存在" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete task node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "删除 Task 节点失败" },
            { status: 500 },
        );
    }
}
