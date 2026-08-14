/**
 * Canvas Project Search API
 *
 * GET /api/canvas/search - 搜索项目和资源
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { searchProjects } from "@/lib/server/canvas-project-resources-store";
import type { CanvasProjectSearchOptions } from "@/lib/canvas-project-resources-contract";

export async function GET(request: NextRequest) {
    try {
        const session = await requireSession(request);
        const { searchParams } = new URL(request.url);

        const options: CanvasProjectSearchOptions = {
            query: searchParams.get("q") || undefined,
            projectType: (searchParams.get("projectType") as any) || undefined,
            projectStatus: (searchParams.get("projectStatus") as any) || undefined,
            tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
            resourceType: (searchParams.get("resourceType") as any) || undefined,
            limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
            offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
        };

        const results = await searchProjects(session.userId, options);
        return NextResponse.json({ results });
    } catch (error) {
        console.error("Failed to search projects:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "搜索项目失败" },
            { status: 500 },
        );
    }
}
