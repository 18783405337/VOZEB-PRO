/**
 * Canvas BrandKit Nodes API
 *
 * GET /api/canvas/:projectId/brandkits/:nodeId - 获取 BrandKit 节点
 * POST /api/canvas/:projectId/brandkits - 创建 BrandKit 节点
 * PATCH /api/canvas/:projectId/brandkits/:nodeId - 更新 BrandKit 节点
 * DELETE /api/canvas/:projectId/brandkits/:nodeId - 删除 BrandKit 节点
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import {
    createBrandKitNode,
    getBrandKitNode,
    updateBrandKitNode,
    deleteBrandKitNode,
} from "@/lib/server/canvas-project-resources-store";
import { getCanvasProject } from "@/lib/server/canvas-project-store";
import type { CreateCanvasBrandKitInput, UpdateCanvasBrandKitInput } from "@/lib/canvas-project-resources-contract";

export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = await context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const brandKit = await getBrandKitNode(projectId, nodeId);
        if (!brandKit) {
            return NextResponse.json({ error: "BrandKit 节点不存在" }, { status: 404 });
        }

        return NextResponse.json(brandKit);
    } catch (error) {
        console.error("Failed to get brandkit node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "获取 BrandKit 节点失败" },
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
        const input: CreateCanvasBrandKitInput = {
            nodeId: body.nodeId,
            summary: body.summary,
            style: body.style,
            composition: body.composition,
            colors: body.colors,
            lighting: body.lighting,
            keywords: body.keywords,
            visualKeywords: body.visualKeywords,
            avoid: body.avoid,
            typography: body.typography,
            approvedNodeIds: body.approvedNodeIds,
            rejectedNodeIds: body.rejectedNodeIds,
        };

        const brandKit = await createBrandKitNode(projectId, session.userId, input);
        return NextResponse.json(brandKit);
    } catch (error) {
        console.error("Failed to create brandkit node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "创建 BrandKit 节点失败" },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = await context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const body = await request.json();
        const input: UpdateCanvasBrandKitInput = body;

        const brandKit = await updateBrandKitNode(projectId, nodeId, input);
        return NextResponse.json(brandKit);
    } catch (error) {
        console.error("Failed to update brandkit node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "更新 BrandKit 节点失败" },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ projectId: string; nodeId: string }> }) {
    try {
        const session = await requireSession(request);
        const { projectId, nodeId } = await context.params;

        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const deleted = await deleteBrandKitNode(projectId, nodeId);
        if (!deleted) {
            return NextResponse.json({ error: "BrandKit 节点不存在" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete brandkit node:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "删除 BrandKit 节点失败" },
            { status: 500 },
        );
    }
}
