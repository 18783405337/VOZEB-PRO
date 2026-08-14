/**
 * Canvas Script Service
 *
 * 处理脚本文档的业务逻辑
 */

import { db } from "@/lib/server/db";

/**
 * 脚本文档数据类型
 */
export type ScriptDocument = {
    id: string;
    projectId: string;
    userId: string;
    scriptId: string;
    title: string;
    content: any;
    markdown: string | null;
    plainText: string;
    characterCount: number;
    wordCount: number;
    revision: number;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * 创建脚本文档
 */
export async function createScriptDocument(
    userId: string,
    projectId: string,
    data: {
        scriptId: string;
        title?: string;
        content: any;
        markdown?: string;
        plainText?: string;
        characterCount?: number;
        wordCount?: number;
    }
): Promise<ScriptDocument> {
    const result = await db.query(
        `INSERT INTO canvas_script_documents (
            user_id, project_id, script_id, title, content, markdown,
            plain_text, character_count, word_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
            userId,
            projectId,
            data.scriptId,
            data.title || "Untitled Script",
            JSON.stringify(data.content),
            data.markdown || null,
            data.plainText || "",
            data.characterCount || 0,
            data.wordCount || 0,
        ]
    );

    return mapRowToScriptDocument(result.rows[0]);
}

/**
 * 获取项目的所有脚本
 */
export async function listScriptDocuments(
    userId: string,
    projectId: string,
    options: {
        page?: number;
        limit?: number;
        search?: string;
    } = {}
): Promise<{ documents: ScriptDocument[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = "user_id = $1 AND project_id = $2";
    const params: any[] = [userId, projectId];

    if (options.search) {
        whereClause += " AND (title ILIKE $3 OR plain_text ILIKE $3)";
        params.push(`%${options.search}%`);
    }

    // 获取总数
    const countResult = await db.query(
        `SELECT COUNT(*) FROM canvas_script_documents WHERE ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    // 获取文档列表
    const result = await db.query(
        `SELECT id, script_id, title, revision, character_count, word_count,
                plain_text, updated_at
         FROM canvas_script_documents
         WHERE ${whereClause}
         ORDER BY updated_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    );

    return {
        documents: result.rows.map(mapRowToScriptDocument),
        total,
    };
}

/**
 * 获取单个脚本文档
 */
export async function getScriptDocument(
    userId: string,
    projectId: string,
    scriptId: string,
    includeContent: boolean = true
): Promise<ScriptDocument | null> {
    const fields = includeContent
        ? "*"
        : "id, script_id, title, revision, character_count, word_count, plain_text, created_at, updated_at";

    const result = await db.query(
        `SELECT ${fields}
         FROM canvas_script_documents
         WHERE user_id = $1 AND project_id = $2 AND script_id = $3`,
        [userId, projectId, scriptId]
    );

    if (result.rows.length === 0) return null;

    return mapRowToScriptDocument(result.rows[0]);
}

/**
 * 更新脚本文档
 */
export async function updateScriptDocument(
    userId: string,
    projectId: string,
    scriptId: string,
    data: {
        title?: string;
        content: any;
        markdown?: string;
        plainText?: string;
        characterCount?: number;
        wordCount?: number;
        createVersion?: boolean;
    }
): Promise<ScriptDocument> {
    // 开始事务
    await db.query("BEGIN");

    try {
        // 获取当前文档
        const currentResult = await db.query(
            `SELECT * FROM canvas_script_documents
             WHERE user_id = $1 AND project_id = $2 AND script_id = $3
             FOR UPDATE`,
            [userId, projectId, scriptId]
        );

        if (currentResult.rows.length === 0) {
            await db.query("ROLLBACK");
            throw new Error("Script document not found");
        }

        const current = currentResult.rows[0];

        // 如果需要创建版本历史
        if (data.createVersion !== false) {
            await db.query(
                `INSERT INTO canvas_script_versions (
                    document_id, revision, content, markdown,
                    character_count, word_count
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    current.id,
                    current.revision,
                    current.content,
                    current.markdown,
                    current.character_count,
                    current.word_count,
                ]
            );
        }

        // 更新文档
        const updateResult = await db.query(
            `UPDATE canvas_script_documents
             SET title = COALESCE($1, title),
                 content = $2,
                 markdown = $3,
                 plain_text = COALESCE($4, plain_text),
                 character_count = COALESCE($5, character_count),
                 word_count = COALESCE($6, word_count),
                 revision = revision + 1,
                 updated_at = NOW()
             WHERE user_id = $7 AND project_id = $8 AND script_id = $9
             RETURNING *`,
            [
                data.title,
                JSON.stringify(data.content),
                data.markdown || null,
                data.plainText,
                data.characterCount,
                data.wordCount,
                userId,
                projectId,
                scriptId,
            ]
        );

        await db.query("COMMIT");

        return mapRowToScriptDocument(updateResult.rows[0]);
    } catch (error) {
        await db.query("ROLLBACK");
        throw error;
    }
}

/**
 * 删除脚本文档
 */
export async function deleteScriptDocument(
    userId: string,
    projectId: string,
    scriptId: string
): Promise<boolean> {
    const result = await db.query(
        `DELETE FROM canvas_script_documents
         WHERE user_id = $1 AND project_id = $2 AND script_id = $3`,
        [userId, projectId, scriptId]
    );

    return result.rowCount > 0;
}

/**
 * 获取版本历史
 */
export async function getScriptVersions(
    userId: string,
    projectId: string,
    scriptId: string,
    limit: number = 10
): Promise<any[]> {
    const result = await db.query(
        `SELECT v.revision, v.character_count, v.word_count, v.description, v.created_at
         FROM canvas_script_versions v
         JOIN canvas_script_documents d ON v.document_id = d.id
         WHERE d.user_id = $1 AND d.project_id = $2 AND d.script_id = $3
         ORDER BY v.revision DESC
         LIMIT $4`,
        [userId, projectId, scriptId, Math.min(50, limit)]
    );

    return result.rows;
}

/**
 * 获取特定版本
 */
export async function getScriptVersion(
    userId: string,
    projectId: string,
    scriptId: string,
    revision: number
): Promise<any | null> {
    const result = await db.query(
        `SELECT v.*
         FROM canvas_script_versions v
         JOIN canvas_script_documents d ON v.document_id = d.id
         WHERE d.user_id = $1 AND d.project_id = $2 AND d.script_id = $3 AND v.revision = $4`,
        [userId, projectId, scriptId, revision]
    );

    if (result.rows.length === 0) return null;

    return {
        ...result.rows[0],
        content: typeof result.rows[0].content === "string"
            ? JSON.parse(result.rows[0].content)
            : result.rows[0].content,
    };
}

/**
 * 恢复到指定版本
 */
export async function restoreScriptVersion(
    userId: string,
    projectId: string,
    scriptId: string,
    revision: number
): Promise<ScriptDocument> {
    await db.query("BEGIN");

    try {
        // 获取要恢复的版本
        const versionResult = await db.query(
            `SELECT v.*
             FROM canvas_script_versions v
             JOIN canvas_script_documents d ON v.document_id = d.id
             WHERE d.user_id = $1 AND d.project_id = $2 AND d.script_id = $3 AND v.revision = $4`,
            [userId, projectId, scriptId, revision]
        );

        if (versionResult.rows.length === 0) {
            await db.query("ROLLBACK");
            throw new Error("Version not found");
        }

        const version = versionResult.rows[0];

        // 更新文档（会自动创建新版本）
        const updated = await updateScriptDocument(userId, projectId, scriptId, {
            content: typeof version.content === "string" ? JSON.parse(version.content) : version.content,
            markdown: version.markdown,
            characterCount: version.character_count,
            wordCount: version.word_count,
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
 * 辅助函数：将数据库行映射为 ScriptDocument
 */
function mapRowToScriptDocument(row: any): ScriptDocument {
    return {
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        scriptId: row.script_id,
        title: row.title,
        content: row.content ? (typeof row.content === "string" ? JSON.parse(row.content) : row.content) : null,
        markdown: row.markdown,
        plainText: row.plain_text,
        characterCount: row.character_count,
        wordCount: row.word_count,
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * 错误处理
 */
export function scriptDocumentError(error: unknown) {
    if (error instanceof Error) {
        if (error.message.includes("not found")) {
            return { status: 404, message: "脚本文档不存在" };
        }
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
            return { status: 409, message: "脚本 ID 已存在" };
        }
    }
    return null;
}
