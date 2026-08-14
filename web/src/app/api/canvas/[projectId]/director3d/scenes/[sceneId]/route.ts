import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
    getDirector3DScene,
    updateDirector3DScene,
    deleteDirector3DScene,
    director3DSceneError,
} from "@/lib/server/canvas-director3d-service";

type Context = { params: Promise<{ projectId: string; sceneId: string }> };

/**
 * GET /api/canvas/[projectId]/director3d/scenes/[sceneId]
 * 获取单个3D场景
 */
export async function GET(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    }

    try {
        const { projectId, sceneId } = await context.params;
        const url = new URL(request.url);
        const includeSnapshot = url.searchParams.get("includeSnapshot") !== "false";

        const scene = await getDirector3DScene(user.id, projectId, sceneId, includeSnapshot);

        if (!scene) {
            return NextResponse.json(
                { code: 404, data: null, msg: "3D场景不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            code: 0,
            data: { scene },
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
        console.error("获取3D场景失败:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "获取3D场景失败" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/canvas/[projectId]/director3d/scenes/[sceneId]
 * 更新3D场景
 */
export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    }

    try {
        const { projectId, sceneId } = await context.params;
        const body = await request.json();

        const { snapshot, cameraCount, lightCount, modelCount, createVersion } = body;

        if (!snapshot) {
            return NextResponse.json(
                { code: 400, data: null, msg: "缺少场景数据" },
                { status: 400 }
            );
        }

        const scene = await updateDirector3DScene(user.id, projectId, sceneId, {
            snapshot,
            cameraCount,
            lightCount,
            modelCount,
            createVersion,
        });

        return NextResponse.json({
            code: 0,
            data: { scene },
            msg: "3D场景已保存",
        });
    } catch (error) {
        const known = director3DSceneError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }
        console.error("更新3D场景失败:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "更新3D场景失败" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/canvas/[projectId]/director3d/scenes/[sceneId]
 * 删除3D场景
 */
export async function DELETE(_request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    }

    try {
        const { projectId, sceneId } = await context.params;

        const deleted = await deleteDirector3DScene(user.id, projectId, sceneId);

        if (!deleted) {
            return NextResponse.json(
                { code: 404, data: null, msg: "3D场景不存在" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            code: 0,
            data: null,
            msg: "3D场景已删除",
        });
    } catch (error) {
        const known = director3DSceneError(error);
        if (known) {
            return NextResponse.json(
                { code: known.status, data: null, msg: known.message },
                { status: known.status }
            );
        }
        console.error("删除3D场景失败:", error);
        return NextResponse.json(
            { code: 500, data: null, msg: "删除3D场景失败" },
            { status: 500 }
        );
    }
}
