/**
 * Canvas Project Resources API
 *
 * GET /api/canvas/:projectId/resources - 获取项目所有资源
 * POST /api/canvas/:projectId/resources - 创建项目资源关联
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import {
    createProjectResource,
    listProjectResources,
    getProjectResourceSummary,
} from "@/lib/server/canvas-project-resources-store";
import { getCanvasProject } from "@/lib/server/canvas-project-store";
import type { CreateCanvasResourceInput } from "@/lib/canvas-project-resources-contract";

export async function GET(request: NextRequest, context: { params: { projectId: string } }) {
    try {
        const session = await requireSession(request);
        const { projectId } = context.params;
        const { searchParams } = new URL(request.url);
        const resourceType = searchParams.get("resourceType") || undefined;
        const summary = searchParams.get("summary") === "true";

        // 验证项目访问权限
        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        if (summary) {
            const resourceSummary = await getProjectResourceSummary(projectId, session.userId);
            return NextResponse.json(resourceSummary);
        }

        const resources = await listProjectResources(projectId, session.userId, resourceType);
        return NextResponse.json({ resources });
    } catch (error) {
        console.error("Failed to list project resources:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "获取项目资源失败" },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest, context: { params: { projectId: string } }) {
    try {
        const session = await requireSession(request);
        const { projectId } = context.params;

        // 验证项目访问权限
        const project = await getCanvasProject(projectId, session.userId);
        if (!project) {
            return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }

        const body = await request.json();
        const input: CreateCanvasResourceInput = {
            nodeId: body.nodeId,
            resourceType: body.resourceType,
            resourceRole: body.resourceRole,
            phase: body.phase,
            deliverableRef: body.deliverableRef,
            sortOrder: body.sortOrder,
            metadata: body.metadata,
        };

        const resource = await createProjectResource(projectId, session.userId, input);
        return NextResponse.json(resource);
    } catch (error) {
        console.error("Failed to create project resource:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "创建项目资源失败" },
            { status: 500 },
        );
    }
}
