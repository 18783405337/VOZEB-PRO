/**
 * Canvas Director 3D Service
 *
 * 处理3D导演台场景的业务逻辑
 */

import { db } from "@/lib/server/db";

/**
 * 3D场景数据类型
 */
export type Director3DScene = {
    id: string;
    projectId: string;
    userId: string;
    sceneId: string;
    snapshot: any;
    revision: number;
    cameraCount: number;
    lightCount: number;
    modelCount: number;
    previewUrl: string | null;
    previewStorageKey: string | null;
    thumbnailUrl: string | null;
    thumbnailStorageKey: string | null;
    renderMetadata: any | null;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * 创建3D场景
 */
export async function createDirector3DScene(
    userId: string,
    projectId: string,
    data: {
        sceneId: string;
        snapshot: any;
        cameraCount?: number;
        lightCount?: number;
        modelCount?: number;
    }
): Promise<Director3DScene> {
    const result = await db.query(
        `INSERT INTO canvas_director3d_scenes (
            user_id, project_id, scene_id, snapshot,
            camera_count, light_count, model_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
            userId,
            projectId,
            data.sceneId,
            JSON.stringify(data.snapshot),
            data.cameraCount || 1,
            data.lightCount || 2,
            data.modelCount || 0,
        ]
    );

    return mapRowToDirector3DScene(result.rows[0]);
}

/**
 * 获取项目的所有3D场景
 */
export async function listDirector3DScenes(
    userId: string,
    projectId: string,
    options: {
        page?: number;
        limit?: number;
    } = {}
): Promise<{ scenes: Director3DScene[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const whereClause = "user_id = $1 AND project_id = $2";
    const params: any[] = [userId, projectId];

    // 获取总数
    const countResult = await db.query(
        `SELECT COUNT(*) FROM canvas_director3d_scenes WHERE ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    // 获取场景列表
    const result = await db.query(
        `SELECT id, scene_id, revision, camera_count, light_count, model_count,
                preview_url, thumbnail_url, updated_at
         FROM canvas_director3d_scenes
         WHERE ${whereClause}
         ORDER BY updated_at DESC
         LIMIT $3 OFFSET $4`,
        [...params, limit, offset]
    );

    return {
        scenes: result.rows.map(mapRowToDirector3DScene),
        total,
    };
}

/**
 * 获取单个3D场景
 */
export async function getDirector3DScene(
    userId: string,
    projectId: string,
    sceneId: string,
    includeSnapshot: boolean = true
): Promise<Director3DScene | null> {
    const fields = includeSnapshot
        ? "*"
        : "id, scene_id, revision, camera_count, light_count, model_count, preview_url, thumbnail_url, created_at, updated_at";

    const result = await db.query(
        `SELECT ${fields}
         FROM canvas_director3d_scenes
         WHERE user_id = $1 AND project_id = $2 AND scene_id = $3`,
        [userId, projectId, sceneId]
    );

    if (result.rows.length === 0) return null;

    return mapRowToDirector3DScene(result.rows[0]);
}

/**
 * 更新3D场景
 */
export async function updateDirector3DScene(
    userId: string,
    projectId: string,
    sceneId: string,
    data: {
        snapshot: any;
        cameraCount?: number;
        lightCount?: number;
        modelCount?: number;
        createVersion?: boolean;
    }
): Promise<Director3DScene> {
    // 开始事务
    await db.query("BEGIN");

    try {
        // 获取当前场景
        const currentResult = await db.query(
            `SELECT * FROM canvas_director3d_scenes
             WHERE user_id = $1 AND project_id = $2 AND scene_id = $3
             FOR UPDATE`,
            [userId, projectId, sceneId]
        );

        if (currentResult.rows.length === 0) {
            await db.query("ROLLBACK");
            throw new Error("3D scene not found");
        }

        const current = currentResult.rows[0];

        // 如果需要创建版本历史
        if (data.createVersion !== false) {
            await db.query(
                `INSERT INTO canvas_director3d_versions (
                    scene_id, revision, snapshot, camera_count, light_count, model_count
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    current.id,
                    current.revision,
                    current.snapshot,
                    current.camera_count,
                    current.light_count,
                    current.model_count,
                ]
            );
        }

        // 更新场景
        const updateResult = await db.query(
            `UPDATE canvas_director3d_scenes
             SET snapshot = $1,
                 revision = revision + 1,
                 camera_count = COALESCE($2, camera_count),
                 light_count = COALESCE($3, light_count),
                 model_count = COALESCE($4, model_count),
                 updated_at = NOW()
             WHERE user_id = $5 AND project_id = $6 AND scene_id = $7
             RETURNING *`,
            [
                JSON.stringify(data.snapshot),
                data.cameraCount,
                data.lightCount,
                data.modelCount,
                userId,
                projectId,
                sceneId,
            ]
        );

        await db.query("COMMIT");

        return mapRowToDirector3DScene(updateResult.rows[0]);
    } catch (error) {
        await db.query("ROLLBACK");
        throw error;
    }
}

/**
 * 删除3D场景
 */
export async function deleteDirector3DScene(
    userId: string,
    projectId: string,
    sceneId: string
): Promise<boolean> {
    const result = await db.query(
        `DELETE FROM canvas_director3d_scenes
         WHERE user_id = $1 AND project_id = $2 AND scene_id = $3`,
        [userId, projectId, sceneId]
    );

    return result.rowCount > 0;
}

/**
 * 获取版本历史
 */
export async function getDirector3DVersions(
    userId: string,
    projectId: string,
    sceneId: string,
    limit: number = 10
): Promise<any[]> {
    const result = await db.query(
        `SELECT v.revision, v.camera_count, v.light_count, v.model_count, v.description, v.created_at
         FROM canvas_director3d_versions v
         JOIN canvas_director3d_scenes s ON v.scene_id = s.id
         WHERE s.user_id = $1 AND s.project_id = $2 AND s.scene_id = $3
         ORDER BY v.revision DESC
         LIMIT $4`,
        [userId, projectId, sceneId, Math.min(50, limit)]
    );

    return result.rows;
}

/**
 * 获取特定版本
 */
export async function getDirector3DVersion(
    userId: string,
    projectId: string,
    sceneId: string,
    revision: number
): Promise<any | null> {
    const result = await db.query(
        `SELECT v.*
         FROM canvas_director3d_versions v
         JOIN canvas_director3d_scenes s ON v.scene_id = s.id
         WHERE s.user_id = $1 AND s.project_id = $2 AND s.scene_id = $3 AND v.revision = $4`,
        [userId, projectId, sceneId, revision]
    );

    if (result.rows.length === 0) return null;

    return result.rows[0];
}

/**
 * 更新场景预览图
 */
export async function updateDirector3DPreview(
    userId: string,
    projectId: string,
    sceneId: string,
    data: {
        previewUrl?: string;
        previewStorageKey?: string;
        thumbnailUrl?: string;
        thumbnailStorageKey?: string;
    }
): Promise<boolean> {
    const result = await db.query(
        `UPDATE canvas_director3d_scenes
         SET preview_url = COALESCE($1, preview_url),
             preview_storage_key = COALESCE($2, preview_storage_key),
             thumbnail_url = COALESCE($3, thumbnail_url),
             thumbnail_storage_key = COALESCE($4, thumbnail_storage_key),
             updated_at = NOW()
         WHERE user_id = $5 AND project_id = $6 AND scene_id = $7`,
        [
            data.previewUrl,
            data.previewStorageKey,
            data.thumbnailUrl,
            data.thumbnailStorageKey,
            userId,
            projectId,
            sceneId,
        ]
    );

    return result.rowCount > 0;
}

/**
 * 辅助函数：将数据库行映射为 Director3DScene
 */
function mapRowToDirector3DScene(row: any): Director3DScene {
    return {
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        sceneId: row.scene_id,
        snapshot: row.snapshot ? (typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot) : null,
        revision: row.revision,
        cameraCount: row.camera_count,
        lightCount: row.light_count,
        modelCount: row.model_count,
        previewUrl: row.preview_url,
        previewStorageKey: row.preview_storage_key,
        thumbnailUrl: row.thumbnail_url,
        thumbnailStorageKey: row.thumbnail_storage_key,
        renderMetadata: row.render_metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * 错误处理
 */
export function director3DSceneError(error: unknown) {
    if (error instanceof Error) {
        if (error.message.includes("not found")) {
            return { status: 404, message: "3D场景不存在" };
        }
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
            return { status: 409, message: "场景 ID 已存在" };
        }
    }
    return null;
}
