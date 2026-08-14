/**
 * Canvas Skill Service
 *
 * 处理技能文档的业务逻辑
 */

import { db } from "./database";
import type { SkillOutputMode } from "@/app/(user)/canvas/skill-types";

/**
 * 技能文档数据类型
 */
export type SkillDocument = {
    id: string;
    projectId: string;
    userId: string;
    skillId: string;
    templateId: string;
    name: string;
    parameters: any;
    status: "idle" | "running" | "success" | "error";
    progress: number;
    output: any | null;
    error: string | null;
    lastExecutedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * 创建技能文档
 */
export async function createSkillDocument(
    userId: string,
    projectId: string,
    data: {
        skillId: string;
        templateId: string;
        name: string;
        parameters?: Record<string, unknown>;
    }
): Promise<SkillDocument> {
    const result = await db.query(
        `INSERT INTO canvas_skill_documents (
            user_id, project_id, skill_id, template_id, name, parameters
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
            userId,
            projectId,
            data.skillId,
            data.templateId,
            data.name,
            JSON.stringify(data.parameters || {}),
        ]
    );

    return mapRowToSkillDocument(result.rows[0]);
}

/**
 * 获取项目的所有技能
 */
export async function listSkillDocuments(
    userId: string,
    projectId: string,
    options: {
        page?: number;
        limit?: number;
        templateId?: string;
        status?: string;
    } = {}
): Promise<{ documents: SkillDocument[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = "user_id = $1 AND project_id = $2";
    const params: any[] = [userId, projectId];

    if (options.templateId) {
        whereClause += " AND template_id = $3";
        params.push(options.templateId);
    }

    if (options.status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(options.status);
    }

    // 获取总数
    const countResult = await db.query(
        `SELECT COUNT(*) FROM canvas_skill_documents WHERE ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    // 获取文档列表
    const result = await db.query(
        `SELECT id, skill_id, template_id, name, status, progress,
                last_executed_at, updated_at
         FROM canvas_skill_documents
         WHERE ${whereClause}
         ORDER BY updated_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );

    return {
        documents: result.rows.map(mapRowToSkillDocument),
        total,
    };
}

/**
 * 获取单个技能文档
 */
export async function getSkillDocument(
    userId: string,
    projectId: string,
    skillId: string,
    includeOutput: boolean = true
): Promise<SkillDocument | null> {
    const fields = includeOutput
        ? "*"
        : "id, skill_id, template_id, name, parameters, status, progress, error, last_executed_at, created_at, updated_at";

    const result = await db.query(
        `SELECT ${fields}
         FROM canvas_skill_documents
         WHERE user_id = $1 AND project_id = $2 AND skill_id = $3`,
        [userId, projectId, skillId]
    );

    if (result.rows.length === 0) return null;

    return mapRowToSkillDocument(result.rows[0]);
}

/**
 * 更新技能文档
 */
export async function updateSkillDocument(
    userId: string,
    projectId: string,
    skillId: string,
    data: {
        name?: string;
        parameters?: Record<string, unknown>;
        status?: "idle" | "running" | "success" | "error";
        progress?: number;
        output?: any;
        error?: string | null;
        lastExecutedAt?: Date;
    }
): Promise<SkillDocument> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
    }

    if (data.parameters !== undefined) {
        updates.push(`parameters = $${paramIndex++}`);
        values.push(JSON.stringify(data.parameters));
    }

    if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(data.status);
    }

    if (data.progress !== undefined) {
        updates.push(`progress = $${paramIndex++}`);
        values.push(data.progress);
    }

    if (data.output !== undefined) {
        updates.push(`output = $${paramIndex++}`);
        values.push(JSON.stringify(data.output));
    }

    if (data.error !== undefined) {
        updates.push(`error = $${paramIndex++}`);
        values.push(data.error);
    }

    if (data.lastExecutedAt !== undefined) {
        updates.push(`last_executed_at = $${paramIndex++}`);
        values.push(data.lastExecutedAt);
    }

    if (updates.length === 0) {
        throw new Error("No fields to update");
    }

    updates.push(`updated_at = NOW()`);

    const result = await db.query(
        `UPDATE canvas_skill_documents
         SET ${updates.join(", ")}
         WHERE user_id = $${paramIndex} AND project_id = $${paramIndex + 1} AND skill_id = $${paramIndex + 2}
         RETURNING *`,
        [...values, userId, projectId, skillId]
    );

    if (result.rows.length === 0) {
        throw new Error("Skill document not found");
    }

    return mapRowToSkillDocument(result.rows[0]);
}

/**
 * 删除技能文档
 */
export async function deleteSkillDocument(
    userId: string,
    projectId: string,
    skillId: string
): Promise<boolean> {
    const result = await db.query(
        `DELETE FROM canvas_skill_documents
         WHERE user_id = $1 AND project_id = $2 AND skill_id = $3`,
        [userId, projectId, skillId]
    );

    return result.rowCount > 0;
}

/**
 * 获取技能执行历史
 */
export async function getSkillExecutionHistory(
    userId: string,
    projectId: string,
    skillId: string,
    limit: number = 10
): Promise<any[]> {
    const result = await db.query(
        `SELECT h.id, h.status, h.parameters, h.output, h.error,
                h.execution_time_ms, h.created_at
         FROM canvas_skill_execution_history h
         JOIN canvas_skill_documents d ON h.skill_document_id = d.id
         WHERE d.user_id = $1 AND d.project_id = $2 AND d.skill_id = $3
         ORDER BY h.created_at DESC
         LIMIT $4`,
        [userId, projectId, skillId, Math.min(50, limit)]
    );

    return result.rows.map(row => ({
        id: row.id,
        status: row.status,
        parameters: row.parameters ? JSON.parse(row.parameters) : {},
        output: row.output ? JSON.parse(row.output) : null,
        error: row.error,
        executionTimeMs: row.execution_time_ms,
        createdAt: row.created_at,
    }));
}

/**
 * 记录技能执行历史
 */
export async function recordSkillExecution(
    userId: string,
    projectId: string,
    skillId: string,
    data: {
        status: "success" | "error";
        parameters: Record<string, unknown>;
        output?: any;
        error?: string;
        executionTimeMs: number;
    }
): Promise<void> {
    // 获取文档 ID
    const docResult = await db.query(
        `SELECT id FROM canvas_skill_documents
         WHERE user_id = $1 AND project_id = $2 AND skill_id = $3`,
        [userId, projectId, skillId]
    );

    if (docResult.rows.length === 0) {
        throw new Error("Skill document not found");
    }

    const documentId = docResult.rows[0].id;

    // 插入执行历史
    await db.query(
        `INSERT INTO canvas_skill_execution_history (
            skill_document_id, status, parameters, output, error, execution_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            documentId,
            data.status,
            JSON.stringify(data.parameters),
            data.output ? JSON.stringify(data.output) : null,
            data.error || null,
            data.executionTimeMs,
        ]
    );
}

/**
 * 获取技能统计信息
 */
export async function getSkillStats(
    userId: string,
    projectId: string,
    skillId: string
): Promise<any> {
    const result = await db.query(
        `SELECT
            COUNT(*) as total_executions,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
            AVG(execution_time_ms) as avg_execution_time
         FROM canvas_skill_execution_history h
         JOIN canvas_skill_documents d ON h.skill_document_id = d.id
         WHERE d.user_id = $1 AND d.project_id = $2 AND d.skill_id = $3`,
        [userId, projectId, skillId]
    );

    const stats = result.rows[0];

    return {
        totalExecutions: parseInt(stats.total_executions) || 0,
        successCount: parseInt(stats.success_count) || 0,
        errorCount: parseInt(stats.error_count) || 0,
        avgExecutionTime: parseFloat(stats.avg_execution_time) || 0,
    };
}

/**
 * 辅助函数：将数据库行映射为 SkillDocument
 */
function mapRowToSkillDocument(row: any): SkillDocument {
    return {
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        skillId: row.skill_id,
        templateId: row.template_id,
        name: row.name,
        parameters: row.parameters ? (typeof row.parameters === "string" ? JSON.parse(row.parameters) : row.parameters) : {},
        status: row.status || "idle",
        progress: row.progress || 0,
        output: row.output ? (typeof row.output === "string" ? JSON.parse(row.output) : row.output) : null,
        error: row.error,
        lastExecutedAt: row.last_executed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * 错误处理
 */
export function skillDocumentError(error: unknown) {
    if (error instanceof Error) {
        if (error.message.includes("not found")) {
            return { status: 404, message: "技能文档不存在" };
        }
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
            return { status: 409, message: "技能 ID 已存在" };
        }
    }
    return null;
}
