import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    createDirector3DScene,
    listDirector3DScenes,
    director3DSceneError,
} from "@/lib/server/canvas-director3d-service";

type Context = { params: Promise<{ projectId: string }> };

/**
 * GET /api/canvas/[projectId]/director3d/scenes
 * 获取项目的所有3D场景列表
 */
export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    }

    try {
        const { projectId } = await context.params;
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");

        const result = await listDirector3DScenes(user.id, projectId, { page, limit });

        return NextResponse.json({
            code: 0,
            data: result,
            msg: "OK",
        });
    } catch (error) {
        const known = director3DSceneError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }
        console.error("获取3D场景列表失败:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取3D场景列表失败" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/canvas/[projectId]/director3d/scenes
 * 创建新的3D场景
 */
export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    }

    try {
        const { projectId } = await context.params;
        const body = await request.json();

        const { sceneId, snapshot, cameraCount, lightCount, modelCount } = body;

        if (!sceneId || !snapshot) {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少必需参数" },
                { status: 400 }
            );
        }

        const scene = await createDirector3DScene(user.id, projectId, {
            sceneId,
            snapshot,
            cameraCount,
            lightCount,
            modelCount,
        });

        return NextResponse.json({
            code: 0,
            data: { scene },
            msg: "3D场景创建成功",
        });
    } catch (error) {
        const known = director3DSceneError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }
        console.error("创建3D场景失败:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "创建3D场景失败" },
            { status: 500 }
        );
    }
}
