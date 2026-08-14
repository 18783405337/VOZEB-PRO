/**
 * Canvas Drawing Service
 *
 * 处理绘图文档的业务逻辑
 */

import { db } from "@/lib/server/db";
import type { CanvasDrawingEngine } from "@/app/(user)/canvas/types";

/**
 * 绘图文档数据类型
 */
export type DrawingDocument = {
    id: string;
    projectId: string;
    userId: string;
    drawingId: string;
    engine: CanvasDrawingEngine;
    snapshot: any;
    revision: number;
    shapeCount: number;
    pageCount: number;
    previewUrl: string | null;
    previewStorageKey: string | null;
    renderUrl: string | null;
    renderStorageKey: string | null;
    renderMetadata: any | null;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * 创建绘图文档
 */
export async function createDrawingDocument(
    userId: string,
    projectId: string,
    data: {
        drawingId: string;
        engine: CanvasDrawingEngine;
        snapshot: any;
        shapeCount?: number;
        pageCount?: number;
    }
): Promise<DrawingDocument> {
    const result = await db.query(
        `INSERT INTO canvas_drawing_documents (
            user_id, project_id, drawing_id, engine, snapshot,
            shape_count, page_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
            userId,
            projectId,
            data.drawingId,
            data.engine,
            JSON.stringify(data.snapshot),
            data.shapeCount || 0,
            data.pageCount || 1,
        ]
    );

    return mapRowToDrawingDocument(result.rows[0]);
}

/**
 * 获取项目的所有绘图
 */
export async function listDrawingDocuments(
    userId: string,
    projectId: string,
    options: {
        page?: number;
        limit?: number;
        engine?: CanvasDrawingEngine;
    } = {}
): Promise<{ documents: DrawingDocument[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = "user_id = $1 AND project_id = $2";
    const params: any[] = [userId, projectId];

    if (options.engine) {
        whereClause += " AND engine = $3";
        params.push(options.engine);
    }

    // 获取总数
    const countResult = await db.query(
        `SELECT COUNT(*) FROM canvas_drawing_documents WHERE ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    // 获取文档列表
    const result = await db.query(
        `SELECT id, drawing_id, engine, revision, shape_count, page_count,
                preview_url, updated_at
         FROM canvas_drawing_documents
         WHERE ${whereClause}
         ORDER BY updated_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );

    return {
        documents: result.rows.map(mapRowToDrawingDocument),
        total,
    };
}

/**
 * 获取单个绘图文档
 */
export async function getDrawingDocument(
    userId: string,
    projectId: string,
    drawingId: string,
    includeSnapshot: boolean = true
): Promise<DrawingDocument | null> {
    const fields = includeSnapshot
        ? "*"
        : "id, drawing_id, engine, revision, shape_count, page_count, preview_url, render_url, created_at, updated_at";

    const result = await db.query(
        `SELECT ${fields}
         FROM canvas_drawing_documents
         WHERE user_id = $1 AND project_id = $2 AND drawing_id = $3`,
        [userId, projectId, drawingId]
    );

    if (result.rows.length === 0) return null;

    return mapRowToDrawingDocument(result.rows[0]);
}

/**
 * 更新绘图文档
 */
export async function updateDrawingDocument(
    userId: string,
    projectId: string,
    drawingId: string,
    data: {
        snapshot: any;
        shapeCount?: number;
        pageCount?: number;
        createVersion?: boolean;
    }
): Promise<DrawingDocument> {
    // 开始事务
    await db.query("BEGIN");

    try {
        // 获取当前文档
        const currentResult = await db.query(
            `SELECT * FROM canvas_drawing_documents
             WHERE user_id = $1 AND project_id = $2 AND drawing_id = $3
             FOR UPDATE`,
            [userId, projectId, drawingId]
        );

        if (currentResult.rows.length === 0) {
            await db.query("ROLLBACK");
            throw new Error("Drawing document not found");
        }

        const current = currentResult.rows[0];

        // 如果需要创建版本历史
        if (data.createVersion !== false) {
            await db.query(
                `INSERT INTO canvas_drawing_versions (
                    document_id, revision, snapshot, shape_count, page_count
                ) VALUES ($1, $2, $3, $4, $5)`,
                [
                    current.id,
                    current.revision,
                    current.snapshot,
                    current.shape_count,
                    current.page_count,
                ]
            );
        }

        // 更新文档
        const updateResult = await db.query(
            `UPDATE canvas_drawing_documents
             SET snapshot = $1,
                 revision = revision + 1,
                 shape_count = COALESCE($2, shape_count),
                 page_count = COALESCE($3, page_count),
                 updated_at = NOW()
             WHERE user_id = $4 AND project_id = $5 AND drawing_id = $6
             RETURNING *`,
            [
                JSON.stringify(data.snapshot),
                data.shapeCount,
                data.pageCount,
                userId,
                projectId,
                drawingId,
            ]
        );

        await db.query("COMMIT");

        return mapRowToDrawingDocument(updateResult.rows[0]);
    } catch (error) {
        await db.query("ROLLBACK");
        throw error;
    }
}

/**
 * 删除绘图文档
 */
export async function deleteDrawingDocument(
    userId: string,
    projectId: string,
    drawingId: string
): Promise<boolean> {
    const result = await db.query(
        `DELETE FROM canvas_drawing_documents
         WHERE user_id = $1 AND project_id = $2 AND drawing_id = $3`,
        [userId, projectId, drawingId]
    );

    return result.rowCount > 0;
}

/**
 * 获取版本历史
 */
export async function getDrawingVersions(
    userId: string,
    projectId: string,
    drawingId: string,
    limit: number = 10
): Promise<any[]> {
    const result = await db.query(
        `SELECT v.revision, v.shape_count, v.page_count, v.description, v.created_at
         FROM canvas_drawing_versions v
         JOIN canvas_drawing_documents d ON v.document_id = d.id
         WHERE d.user_id = $1 AND d.project_id = $2 AND d.drawing_id = $3
         ORDER BY v.revision DESC
         LIMIT $4`,
        [userId, projectId, drawingId, Math.min(50, limit)]
    );

    return result.rows;
}

/**
 * 获取特定版本
 */
export async function getDrawingVersion(
    userId: string,
    projectId: string,
    drawingId: string,
    revision: number
): Promise<any | null> {
    const result = await db.query(
        `SELECT v.*
         FROM canvas_drawing_versions v
         JOIN canvas_drawing_documents d ON v.document_id = d.id
         WHERE d.user_id = $1 AND d.project_id = $2 AND d.drawing_id = $3 AND v.revision = $4`,
        [userId, projectId, drawingId, revision]
    );

    if (result.rows.length === 0) return null;

    return result.rows[0];
}

/**
 * 恢复到指定版本
 */
export async function restoreDrawingVersion(
    userId: string,
    projectId: string,
    drawingId: string,
    revision: number
): Promise<DrawingDocument> {
    await db.query("BEGIN");

    try {
        // 获取要恢复的版本
        const versionResult = await db.query(
            `SELECT v.*
             FROM canvas_drawing_versions v
             JOIN canvas_drawing_documents d ON v.document_id = d.id
             WHERE d.user_id = $1 AND d.project_id = $2 AND d.drawing_id = $3 AND v.revision = $4`,
            [userId, projectId, drawingId, revision]
        );

        if (versionResult.rows.length === 0) {
            await db.query("ROLLBACK");
            throw new Error("Version not found");
        }

        const version = versionResult.rows[0];

        // 更新文档（会自动创建新版本）
        const updated = await updateDrawingDocument(userId, projectId, drawingId, {
            snapshot: JSON.parse(version.snapshot),
            shapeCount: version.shape_count,
            pageCount: version.page_count,
            createVersion: true,
        });

        await db.query("COMMIT");

        return updated;
    } catch (error) {
        await db.query("ROLLBACK");
        throw error;
    }
}

/**
 * 辅助函数：将数据库行映射为 DrawingDocument
 */
function mapRowToDrawingDocument(row: any): DrawingDocument {
    return {
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        drawingId: row.drawing_id,
        engine: row.engine,
        snapshot: row.snapshot ? (typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot) : null,
        revision: row.revision,
        shapeCount: row.shape_count,
        pageCount: row.page_count,
        previewUrl: row.preview_url,
        previewStorageKey: row.preview_storage_key,
        renderUrl: row.render_url,
        renderStorageKey: row.render_storage_key,
        renderMetadata: row.render_metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * 错误处理
 */
export function drawingDocumentError(error: unknown) {
    if (error instanceof Error) {
        if (error.message.includes("not found")) {
            return { status: 404, message: "绘图文档不存在" };
        }
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
            return { status: 409, message: "绘图 ID 已存在" };
        }
    }
    return null;
}
