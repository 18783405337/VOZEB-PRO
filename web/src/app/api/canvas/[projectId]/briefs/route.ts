/**
 * Canvas Brief Nodes API
 *
 * GET /api/canvas/:projectId/briefs/:nodeId - 获取 Brief 节点
 * POST /api/canvas/:projectId/briefs - 创建 Brief 节点
 * PATCH /api/canvas/:projectId/briefs/:nodeId - 更新 Brief 节点
 * DELETE /api/canvas/:projectId/briefs/:nodeId - 删除 Brief 节点
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import {
    createBriefNode,
    getBriefNode,
    updateBriefNode,
    deleteBriefNode,
} from "@/lib/server/canvas-project-resources-store";
import { getCanvasProject } from "@/lib/server/canvas-project-store";
import type { CreateCanvasBriefInput, UpdateCanvasBriefInput } from "@/lib/canvas-project-resources-contract";

export async function GET(request: NextRequest, context: { params: { projectId: string; nodeId: string } }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const brief = await getBriefNode(projectId, nodeId);
        if (!brief) {
            return NextResponse.json({ error: "Brief 节点不存在" }, { status: 404 });
        }

        return NextResponse.json(brief);
    } catch (error) {
        console.error("Failed to get brief node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "获取 Brief 节点失败" },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest, context: { params: { projectId: string } }) {
    try {
        const session = await requireSession(request);
        const { projectId } = context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const body = await request.json();
        const input: CreateCanvasBriefInput = {
            nodeId: body.nodeId,
            objective: body.objective,
            audience: body.audience,
            usage: body.usage,
            coreMessage: body.coreMessage,
            referenceStrategy: body.referenceStrategy,
            tone: body.tone,
            deliverables: body.deliverables,
            constraints: body.constraints,
            referencedNodeIds: body.referencedNodeIds,
        };

        const brief = await createBriefNode(projectId, session.userId, input);
        return NextResponse.json(brief);
    } catch (error) {
        console.error("Failed to create brief node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "创建 Brief 节点失败" },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest, context: { params: { projectId: string; nodeId: string } }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const body = await request.json();
        const input: UpdateCanvasBriefInput = body;

        const brief = await updateBriefNode(projectId, nodeId, input);
        return NextResponse.json(brief);
    } catch (error) {
        console.error("Failed to update brief node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "更新 Brief 节点失败" },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest, context: { params: { projectId: string; nodeId: string } }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const deleted = await deleteBriefNode(projectId, nodeId);
        if (!deleted) {
            return NextResponse.json({ error: "Brief 节点不存在" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete brief node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "删除 Brief 节点失败" },
            { status: 500 },
        );
    }
}
