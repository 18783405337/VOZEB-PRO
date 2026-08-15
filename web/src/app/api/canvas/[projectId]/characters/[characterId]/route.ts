import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    getCharacterDocument,
    updateCharacterDocument,
    deleteCharacterDocument,
    characterDocumentError,
} from "@/lib/server/canvas-character-service";

type RouteContext = {
    params: { projectId: string; characterId: string };
};

/**
 * GET /api/canvas/[projectId]/characters/[characterId]
 * 获取单个角色文档
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
        const { projectId, characterId } = await params;
        const url = new URL(request.url);
        const includeImages = url.searchParams.get("includeImages") !== "false";

        const document = await getCharacterDocument(
            user.id,
            projectId,
            characterId,
            { includeImages }
        );

        if (!document) {
            return NextResponse.json(
                { code: 404, data: null, msg: "角色文档不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            code: 0,
            data: { document },
            msg: "OK",
        });
    } catch (error) {
        console.error("Failed to get character:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取角色文档失败" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/canvas/[projectId]/characters/[characterId]
 * 更新角色文档
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
        const { projectId, characterId } = await params;
        const body = await request.json();

        const document = await updateCharacterDocument(
            user.id,
            projectId,
            characterId,
            {
                basicInfo: body.basicInfo,
                appearance: body.appearance,
                personality: body.personality,
                referenceImages: body.referenceImages,
                createVersion: body.createVersion,
                versionDescription: body.versionDescription,
            }
        );

        return NextResponse.json({
            code: 0,
            data: { document },
            msg: "角色文档已更新",
        });
    } catch (error) {
        const known = characterDocumentError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }

        console.error("Failed to update character:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "更新角色文档失败" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/canvas/[projectId]/characters/[characterId]
 * 删除角色文档
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
        const { projectId, characterId } = await params;

        const deleted = await deleteCharacterDocument(user.id, projectId, characterId);

        if (!deleted) {
            return NextResponse.json(
                { code: 404, data: null, msg: "角色文档不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { code: 0, data: { deleted: true }, msg: "角色文档已删除" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Failed to delete character:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "删除角色文档失败" },
            { status: 500 }
        );
    }
}
