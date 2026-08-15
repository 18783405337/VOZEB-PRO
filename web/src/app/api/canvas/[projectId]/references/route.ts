/**
 * Canvas Node References API
 *
 * GET /api/canvas/:projectId/references/:nodeId - 获取节点的引用关系
 * POST /api/canvas/:projectId/references - 创建节点引用
 * DELETE /api/canvas/:projectId/references - 删除节点引用
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import {
    createNodeReference,
    listNodeReferences,
    deleteNodeReference,
    getNodeDependencyGraph,
} from "@/lib/server/canvas-project-resources-store";
import { getCanvasProject } from "@/lib/server/canvas-project-store";
import type { CreateCanvasNodeReferenceInput } from "@/lib/canvas-project-resources-contract";

export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = await context.params;
        const { searchParams } = new URL(request.url);
        const direction = (searchParams.get("direction") || "both") as "outgoing" | "incoming" | "both";
        const graph = searchParams.get("graph") === "true";

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        if (graph) {
            const dependencyGraph = await getNodeDependencyGraph(projectId, nodeId);
            return NextResponse.json(dependencyGraph);
        }

        const references = await listNodeReferences(projectId, nodeId, direction);
        return NextResponse.json({ references });
    } catch (error) {
        console.error("Failed to get node references:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "获取节点引用失败" },
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
        const input: CreateCanvasNodeReferenceInput = {
            sourceNodeId: body.sourceNodeId,
            targetNodeId: body.targetNodeId,
            referenceType: body.referenceType,
            referenceContext: body.referenceContext,
            metadata: body.metadata,
        };

        const reference = await createNodeReference(projectId, session.userId, input);
        return NextResponse.json(reference);
    } catch (error) {
        console.error("Failed to create node reference:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "创建节点引用失败" },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
    try {
        const session = await requireSession(request);
        const { projectId } = await context.params;
        const { searchParams } = new URL(request.url);
        const sourceNodeId = searchParams.get("sourceNodeId");
        const targetNodeId = searchParams.get("targetNodeId");
        const referenceType = searchParams.get("referenceType");

        if (!sourceNodeId || !targetNodeId || !referenceType) {
            return NextResponse.json({ error: "缺少必需参数" }, { status: 400 });
        }

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const deleted = await deleteNodeReference(projectId, sourceNodeId, targetNodeId, referenceType);
        if (!deleted) {
            return NextResponse.json({ error: "引用关系不存在" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete node reference:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "删除节点引用失败" },
            { status: 500 },
        );
    }
}
