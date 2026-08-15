import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    createScriptDocument,
    listScriptDocuments,
    scriptDocumentError,
} from "@/lib/server/canvas-script-service";

type RouteContext = {
    params: { projectId: string };
};

/**
 * GET /api/canvas/[projectId]/scripts
 * 列出项目的所有脚本
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
        const { projectId } = await params;
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const search = url.searchParams.get("search") || undefined;

        const result = await listScriptDocuments(user.id, projectId, {
            page,
            limit,
            search,
        });

        const totalPages = Math.ceil(result.total / limit);

        return NextResponse.json({
            code: 0,
            data: {
                scripts: result.documents,
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
        console.error("Failed to list scripts:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取脚本列表失败" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/canvas/[projectId]/scripts
 * 创建新的脚本文档
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
        const { projectId } = await params;
        const body = await request.json();

        // 验证必填字段
        if (!body.scriptId || !body.content) {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少必填字段" },
                { status: 400 }
            );
        }

        const document = await createScriptDocument(user.id, projectId, {
            scriptId: body.scriptId,
            title: body.title,
            content: body.content,
            markdown: body.markdown,
            plainText: body.plainText,
            characterCount: body.characterCount,
            wordCount: body.wordCount,
        });

        return NextResponse.json(
            {
                code: 0,
                data: { document },
                msg: "脚本文档已创建",
            },
            { status: 201 }
        );
    } catch (error) {
        const known = scriptDocumentError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }

        console.error("Failed to create script:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "创建脚本文档失败" },
            { status: 500 }
        );
    }
}
