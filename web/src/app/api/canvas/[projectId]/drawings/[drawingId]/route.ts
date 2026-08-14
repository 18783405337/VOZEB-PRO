import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    getDrawingDocument,
    updateDrawingDocument,
    deleteDrawingDocument,
    drawingDocumentError,
} from "@/lib/server/canvas-drawing-service";

type RouteContext = {
    params: { projectId: string; drawingId: string };
};

/**
 * GET /api/canvas/[projectId]/drawings/[drawingId]
 * 获取单个绘图文档
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
        const { projectId, drawingId } = params;
        const url = new URL(request.url);
        const includeSnapshot = url.searchParams.get("includeSnapshot") !== "false";

        const document = await getDrawingDocument(
            user.id,
            projectId,
            drawingId,
            includeSnapshot
        );

        if (!document) {
            return NextResponse.json(
                { code: 404, data: null, msg: "绘图文档不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            code: 0,
            data: { document },
            msg: "OK",
        });
    } catch (error) {
        console.error("Failed to get drawing:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取绘图文档失败" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/canvas/[projectId]/drawings/[drawingId]
 * 更新绘图文档
 */
export async function PUT(request: Request, { params }: RouteContext) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json(
            { code: 401, data: null, msg: "请先登录" },
            { status: 401 }
        );
    }

    try {
        const { projectId, drawingId } = params;
        const body = await request.json();

        if (!body.snapshot) {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少 snapshot 字段" },
                { status: 400 }
            );
        }

        const document = await updateDrawingDocument(
            user.id,
            projectId,
            drawingId,
            {
                snapshot: body.snapshot,
                shapeCount: body.shapeCount,
                pageCount: body.pageCount,
                createVersion: body.createVersion,
            }
        );

        return NextResponse.json({
            code: 0,
            data: { document },
            msg: "绘图文档已更新",
        });
    } catch (error) {
        const known = drawingDocumentError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }

        console.error("Failed to update drawing:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "更新绘图文档失败" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/canvas/[projectId]/drawings/[drawingId]
 * 删除绘图文档
 */
export async function DELETE(request: Request, { params }: RouteContext) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json(
            { code: 401, data: null, msg: "请先登录" },
            { status: 401 }
        );
    }

    try {
        const { projectId, drawingId } = params;

        const deleted = await deleteDrawingDocument(user.id, projectId, drawingId);

        if (!deleted) {
            return NextResponse.json(
                { code: 404, data: null, msg: "绘图文档不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { code: 0, data: { deleted: true }, msg: "绘图文档已删除" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Failed to delete drawing:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "删除绘图文档失败" },
            { status: 500 }
        );
    }
}
