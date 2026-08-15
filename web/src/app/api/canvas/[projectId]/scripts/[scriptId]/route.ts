import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    getScriptDocument,
    updateScriptDocument,
    deleteScriptDocument,
    scriptDocumentError,
} from "@/lib/server/canvas-script-service";

type RouteContext = {
    params: { projectId: string; scriptId: string };
};

/**
 * GET /api/canvas/[projectId]/scripts/[scriptId]
 * 获取单个脚本文档
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
        const { projectId, scriptId } = await params;
        const url = new URL(request.url);
        const includeContent = url.searchParams.get("includeContent") !== "false";

        const document = await getScriptDocument(
            user.id,
            projectId,
            scriptId,
            includeContent
        );

        if (!document) {
            return NextResponse.json(
                { code: 404, data: null, msg: "脚本文档不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            code: 0,
            data: { document },
            msg: "OK",
        });
    } catch (error) {
        console.error("Failed to get script:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取脚本文档失败" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/canvas/[projectId]/scripts/[scriptId]
 * 更新脚本文档
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
        const { projectId, scriptId } = await params;
        const body = await request.json();

        if (!body.content) {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少 content 字段" },
                { status: 400 }
            );
        }

        const document = await updateScriptDocument(
            user.id,
            projectId,
            scriptId,
            {
                title: body.title,
                content: body.content,
                markdown: body.markdown,
                plainText: body.plainText,
                characterCount: body.characterCount,
                wordCount: body.wordCount,
                createVersion: body.createVersion,
            }
        );

        return NextResponse.json({
            code: 0,
            data: { document },
            msg: "脚本文档已更新",
        });
    } catch (error) {
        const known = scriptDocumentError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }

        console.error("Failed to update script:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "更新脚本文档失败" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/canvas/[projectId]/scripts/[scriptId]
 * 删除脚本文档
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
        const { projectId, scriptId } = await params;

        const deleted = await deleteScriptDocument(user.id, projectId, scriptId);

        if (!deleted) {
            return NextResponse.json(
                { code: 404, data: null, msg: "脚本文档不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { code: 0, data: { deleted: true }, msg: "脚本文档已删除" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Failed to delete script:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "删除脚本文档失败" },
            { status: 500 }
        );
    }
}
