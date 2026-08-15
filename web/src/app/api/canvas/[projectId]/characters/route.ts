import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    createCharacterDocument,
    listCharacterDocuments,
    characterDocumentError,
} from "@/lib/server/canvas-character-service";

type RouteContext = {
    params: Promise<{ projectId: string }>;
};

/**
 * GET /api/canvas/[projectId]/characters
 * 列出项目的所有角色
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
        const characterType = url.searchParams.get("characterType") || undefined;
        const tags = url.searchParams.get("tags")?.split(",").filter(Boolean);

        const result = await listCharacterDocuments(user.id, projectId, {
            page,
            limit,
            search,
            characterType,
            tags,
        });

        const totalPages = Math.ceil(result.total / limit);

        return NextResponse.json({
            code: 0,
            data: {
                characters: result.documents,
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
        console.error("Failed to list characters:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取角色列表失败" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/canvas/[projectId]/characters
 * 创建新的角色文档
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
        if (!body.characterId || !body.basicInfo || !body.appearance) {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少必填字段" },
                { status: 400 }
            );
        }

        const document = await createCharacterDocument(user.id, projectId, {
            characterId: body.characterId,
            basicInfo: body.basicInfo,
            appearance: body.appearance,
            personality: body.personality,
            referenceImages: body.referenceImages || [],
        });

        return NextResponse.json(
            {
                code: 0,
                data: { document },
                msg: "角色文档已创建",
            },
            { status: 201 }
        );
    } catch (error) {
        const known = characterDocumentError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }

        console.error("Failed to create character:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "创建角色文档失败" },
            { status: 500 }
        );
    }
}
