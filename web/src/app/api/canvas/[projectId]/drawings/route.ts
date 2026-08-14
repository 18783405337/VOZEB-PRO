import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    createDrawingDocument,
    listDrawingDocuments,
    drawingDocumentError,
} from "@/lib/server/canvas-drawing-service";

type RouteContext = {
    params: { projectId: string };
};

/**
 * GET /api/canvas/[projectId]/drawings
 * 列出项目的所有绘图
 */
export async function GET(request: Request, { params }: RouteContext) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json(
            { code: 401, data: null, msg: "请先登录" },
            { status: 401 }
        );
    }

    try {
        const { projectId } = params;
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const engine = url.searchParams.get("engine") as any;

        const result = await listDrawingDocuments(user.id, projectId, {
            page,
            limit,
            engine,
        });

        const totalPages = Math.ceil(result.total / limit);

        return NextResponse.json({
            code: 0,
            data: {
                drawings: result.documents,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages,
                },
            },
            msg: "OK",
        });
    } catch (error) {
        console.error("Failed to list drawings:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取绘图列表失败" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/canvas/[projectId]/drawings
 * 创建新的绘图文档
 */
export async function POST(request: Request, { params }: RouteContext) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json(
            { code: 401, data: null, msg: "请先登录" },
            { status: 401 }
        );
    }

    try {
        const { projectId } = params;
        const body = await request.json();

        // 验证必填字段
        if (!body.drawingId || !body.engine || !body.snapshot) {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少必填字段" },
                { status: 400 }
            );
        }

        const document = await createDrawingDocument(user.id, projectId, {
            drawingId: body.drawingId,
            engine: body.engine,
            snapshot: body.snapshot,
            shapeCount: body.shapeCount,
            pageCount: body.pageCount,
        });

        return NextResponse.json(
            {
                code: 0,
                data: { document },
                msg: "绘图文档已创建",
            },
            { status: 201 }
        );
    } catch (error) {
        const known = drawingDocumentError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }

        console.error("Failed to create drawing:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "创建绘图文档失败" },
            { status: 500 }
        );
    }
}
