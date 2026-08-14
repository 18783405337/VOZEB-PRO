/**
 * Canvas Character Service
 *
 * 处理角色文档的业务逻辑
 */

import { db } from "@/lib/server/db";
import type {
    CanvasCharacterDocument,
    CharacterBasicInfo,
    CharacterAppearance,
    CharacterPersonality,
    CharacterReferenceImage,
    CanvasCharacterVersion,
    ConsistencyCheckResult,
} from "@/app/(user)/canvas/character-types";

/**
 * 角色文档数据类型 (数据库)
 */
export type CharacterDocument = {
    id: string;
    projectId: string;
    userId: string;
    characterId: string;
    basicInfo: CharacterBasicInfo;
    appearance: CharacterAppearance;
    personality: CharacterPersonality | null;
    referenceImages: CharacterReferenceImage[];
    revision: number;
    createdAt: Date;
    updatedAt: Date;
    lastConsistencyCheck: ConsistencyCheckResult | null;
    versionDrift: any;
};

/**
 * 创建角色文档
 */
export async function createCharacterDocument(
    userId: string,
    projectId: string,
    data: {
        characterId: string;
        basicInfo: CharacterBasicInfo;
        appearance: CharacterAppearance;
        personality?: CharacterPersonality;
        referenceImages?: CharacterReferenceImage[];
    }
): Promise<CanvasCharacterDocument> {
    // 检查角色 ID 是否已存在
    const existing = await db.query(
        `SELECT id FROM canvas_character_documents
         WHERE user_id = $1 AND project_id = $2 AND character_id = $3`,
        [userId, projectId, data.characterId]
    );

    if (existing.rows.length > 0) {
        throw new Error("CHARACTER_ID_EXISTS");
    }

    const result = await db.query(
        `INSERT INTO canvas_character_documents (
            user_id, project_id, character_id, basic_info, appearance,
            personality, reference_images
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
            userId,
            projectId,
            data.characterId,
            JSON.stringify(data.basicInfo),
            JSON.stringify(data.appearance),
            data.personality ? JSON.stringify(data.personality) : null,
            JSON.stringify(data.referenceImages || []),
        ]
    );

    return mapRowToCharacterDocument(result.rows[0]);
}

/**
 * 获取角色文档
 */
export async function getCharacterDocument(
    userId: string,
    projectId: string,
    characterId: string,
    options: { includeImages?: boolean } = {}
): Promise<CanvasCharacterDocument | null> {
    const result = await db.query(
        `SELECT * FROM canvas_character_documents
         WHERE user_id = $1 AND project_id = $2 AND character_id = $3`,
        [userId, projectId, characterId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const doc = mapRowToCharacterDocument(result.rows[0]);

    // 可选：不返回图片数据以减少传输
    if (options.includeImages === false) {
        doc.referenceImages = doc.referenceImages.map((img) => ({
            ...img,
            storageKey: undefined,
            remoteUrl: undefined,
        }));
    }

    return doc;
}

/**
 * 更新角色文档
 */
export async function updateCharacterDocument(
    userId: string,
    projectId: string,
    characterId: string,
    data: {
        basicInfo?: CharacterBasicInfo;
        appearance?: CharacterAppearance;
        personality?: CharacterPersonality;
        referenceImages?: CharacterReferenceImage[];
        createVersion?: boolean;
        versionDescription?: string;
    }
): Promise<CanvasCharacterDocument> {
    // 获取当前文档
    const current = await getCharacterDocument(userId, projectId, characterId);
    if (!current) {
        throw new Error("CHARACTER_NOT_FOUND");
    }

    // 如果需要创建版本，先保存当前版本
    if (data.createVersion) {
        await createCharacterVersion(
            userId,
            projectId,
            characterId,
            current.revision,
            {
                basicInfo: current.basicInfo,
                appearance: current.appearance,
                personality: current.personality,
                referenceImages: current.referenceImages,
            },
            data.versionDescription
        );
    }

    // 准备更新的字段
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (data.basicInfo) {
        updates.push(`basic_info = $${paramCount}`);
        params.push(JSON.stringify(data.basicInfo));
        paramCount++;
    }

    if (data.appearance) {
        updates.push(`appearance = $${paramCount}`);
        params.push(JSON.stringify(data.appearance));
        paramCount++;
    }

    if (data.personality !== undefined) {
        updates.push(`personality = $${paramCount}`);
        params.push(data.personality ? JSON.stringify(data.personality) : null);
        paramCount++;
    }

    if (data.referenceImages) {
        updates.push(`reference_images = $${paramCount}`);
        params.push(JSON.stringify(data.referenceImages));
        paramCount++;
    }

    if (data.createVersion) {
        updates.push(`revision = revision + 1`);
    }

    updates.push(`updated_at = NOW()`);

    // 添加 WHERE 条件参数
    params.push(userId, projectId, characterId);

    const result = await db.query(
        `UPDATE canvas_character_documents
         SET ${updates.join(", ")}
         WHERE user_id = $${paramCount} AND project_id = $${paramCount + 1}
               AND character_id = $${paramCount + 2}
         RETURNING *`,
        params
    );

    return mapRowToCharacterDocument(result.rows[0]);
}

/**
 * 删除角色文档
 */
export async function deleteCharacterDocument(
    userId: string,
    projectId: string,
    characterId: string
): Promise<boolean> {
    // 先删除版本历史
    await db.query(
        `DELETE FROM canvas_character_versions
         WHERE user_id = $1 AND project_id = $2 AND character_id = $3`,
        [userId, projectId, characterId]
    );

    // 删除一致性检查历史
    await db.query(
        `DELETE FROM canvas_character_consistency_checks
         WHERE user_id = $1 AND project_id = $2 AND character_id = $3`,
        [userId, projectId, characterId]
    );

    // 删除主文档
    const result = await db.query(
        `DELETE FROM canvas_character_documents
         WHERE user_id = $1 AND project_id = $2 AND character_id = $3
         RETURNING id`,
        [userId, projectId, characterId]
    );

    return result.rows.length > 0;
}

/**
 * 获取项目的所有角色
 */
export async function listCharacterDocuments(
    userId: string,
    projectId: string,
    options: {
        page?: number;
        limit?: number;
        search?: string;
        characterType?: string;
        tags?: string[];
    } = {}
): Promise<{ documents: CanvasCharacterDocument[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = "user_id = $1 AND project_id = $2";
    const params: any[] = [userId, projectId];
    let paramCount = 3;

    if (options.search) {
        whereClause += ` AND (
            basic_info->>'name' ILIKE $${paramCount} OR
            basic_info->>'description' ILIKE $${paramCount} OR
            appearance->>'visualDescription' ILIKE $${paramCount}
        )`;
        params.push(`%${options.search}%`);
        paramCount++;
    }

    if (options.characterType) {
        whereClause += ` AND basic_info->>'characterType' = $${paramCount}`;
        params.push(options.characterType);
        paramCount++;
    }

    if (options.tags && options.tags.length > 0) {
        whereClause += ` AND basic_info->'tags' ?| $${paramCount}`;
        params.push(options.tags);
        paramCount++;
    }

    // 获取总数
    const countResult = await db.query(
        `SELECT COUNT(*) FROM canvas_character_documents WHERE ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    // 获取文档列表
    const result = await db.query(
        `SELECT * FROM canvas_character_documents
         WHERE ${whereClause}
         ORDER BY updated_at DESC
         LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        [...params, limit, offset]
    );

    const documents = result.rows.map(mapRowToCharacterDocument);

    return { documents, total };
}

/**
 * 创建角色版本
 */
async function createCharacterVersion(
    userId: string,
    projectId: string,
    characterId: string,
    revision: number,
    snapshot: {
        basicInfo: CharacterBasicInfo;
        appearance: CharacterAppearance;
        personality?: CharacterPersonality;
        referenceImages: CharacterReferenceImage[];
    },
    description?: string
): Promise<void> {
    await db.query(
        `INSERT INTO canvas_character_versions (
            user_id, project_id, character_id, revision, snapshot, description
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            userId,
            projectId,
            characterId,
            revision,
            JSON.stringify(snapshot),
            description || null,
        ]
    );
}

/**
 * 获取角色版本历史
 */
export async function getCharacterVersions(
    userId: string,
    projectId: string,
    characterId: string,
    limit: number = 20
): Promise<CanvasCharacterVersion[]> {
    const result = await db.query(
        `SELECT * FROM canvas_character_versions
         WHERE user_id = $1 AND project_id = $2 AND character_id = $3
         ORDER BY revision DESC
         LIMIT $4`,
        [userId, projectId, characterId, limit]
    );

    return result.rows.map(mapRowToCharacterVersion);
}

/**
 * 获取特定版本
 */
export async function getCharacterVersion(
    userId: string,
    projectId: string,
    characterId: string,
    revision: number
): Promise<CanvasCharacterVersion | null> {
    const result = await db.query(
        `SELECT * FROM canvas_character_versions
         WHERE user_id = $1 AND project_id = $2 AND character_id = $3 AND revision = $4`,
        [userId, projectId, characterId, revision]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return mapRowToCharacterVersion(result.rows[0]);
}

/**
 * 恢复到指定版本
 */
export async function restoreCharacterVersion(
    userId: string,
    projectId: string,
    characterId: string,
    revision: number
): Promise<CanvasCharacterDocument> {
    const version = await getCharacterVersion(userId, projectId, characterId, revision);
    if (!version) {
        throw new Error("VERSION_NOT_FOUND");
    }

    return updateCharacterDocument(userId, projectId, characterId, {
        basicInfo: version.snapshot.basicInfo,
        appearance: version.snapshot.appearance,
        personality: version.snapshot.personality,
        referenceImages: version.snapshot.referenceImages,
        createVersion: true,
        versionDescription: `Restored from revision ${revision}`,
    });
}

/**
 * 检查角色一致性
 */
export async function checkCharacterConsistency(
    userId: string,
    projectId: string,
    characterId: string,
    options: {
        targetImageUrl: string;
        checkType: "visual_similarity" | "prompt_consistency" | "version_comparison";
        algorithms?: string[];
        threshold?: number;
    }
): Promise<ConsistencyCheckResult> {
    const character = await getCharacterDocument(userId, projectId, characterId);
    if (!character) {
        throw new Error("CHARACTER_NOT_FOUND");
    }

    // 生成检查 ID
    const checkId = `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 这里应该调用实际的图像比较服务
    // 暂时返回模拟结果
    const checkResult: ConsistencyCheckResult = {
        checkId,
        checkType: options.checkType,
        consistencyScore: 0.85, // 模拟得分
        status: "completed",
        details: {
            algorithm: options.algorithms?.[0] as any || "phash",
            hammingDistance: 8,
            warnings: [],
        },
        targetImageId: options.targetImageUrl,
        checkedAt: new Date().toISOString(),
    };

    // 保存检查结果到数据库
    await db.query(
        `INSERT INTO canvas_character_consistency_checks (
            user_id, project_id, character_id, check_id, check_type,
            consistency_score, status, details, target_image_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
            userId,
            projectId,
            characterId,
            checkId,
            options.checkType,
            checkResult.consistencyScore,
            checkResult.status,
            JSON.stringify(checkResult.details),
            options.targetImageUrl,
        ]
    );

    // 更新角色文档的最后检查结果
    await db.query(
        `UPDATE canvas_character_documents
         SET last_consistency_check = $1, updated_at = NOW()
         WHERE user_id = $2 AND project_id = $3 AND character_id = $4`,
        [JSON.stringify(checkResult), userId, projectId, characterId]
    );

    return checkResult;
}

/**
 * 获取一致性检查历史
 */
export async function getConsistencyHistory(
    userId: string,
    projectId: string,
    characterId: string,
    limit: number = 20
): Promise<{ checks: ConsistencyCheckResult[]; summary: any }> {
    const result = await db.query(
        `SELECT * FROM canvas_character_consistency_checks
         WHERE user_id = $1 AND project_id = $2 AND character_id = $3
         ORDER BY created_at DESC
         LIMIT $4`,
        [userId, projectId, characterId, limit]
    );

    const checks: ConsistencyCheckResult[] = result.rows.map((row) => ({
        checkId: row.check_id,
        checkType: row.check_type,
        consistencyScore: parseFloat(row.consistency_score),
        status: row.status,
        details: row.details,
        baseImageId: row.base_image_id,
        targetImageId: row.target_image_id,
        checkedAt: row.created_at.toISOString(),
        error: row.error,
    }));

    // 计算汇总统计
    const summary = {
        totalChecks: checks.length,
        averageScore:
            checks.length > 0
                ? checks.reduce((sum, c) => sum + c.consistencyScore, 0) / checks.length
                : 0,
        passRate:
            checks.length > 0
                ? checks.filter((c) => c.consistencyScore >= 0.75).length / checks.length
                : 0,
        lastCheckedAt: checks.length > 0 ? checks[0].checkedAt : null,
    };

    return { checks, summary };
}

/**
 * 映射数据库行到角色文档
 */
function mapRowToCharacterDocument(row: any): CanvasCharacterDocument {
    return {
        characterId: row.character_id,
        projectId: row.project_id,
        basicInfo: row.basic_info,
        appearance: row.appearance,
        personality: row.personality,
        referenceImages: row.reference_images || [],
        revision: row.revision,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        lastConsistencyCheck: row.last_consistency_check,
        versionDrift: row.version_drift,
    };
}

/**
 * 映射数据库行到版本
 */
function mapRowToCharacterVersion(row: any): CanvasCharacterVersion {
    return {
        revision: row.revision,
        snapshot: row.snapshot,
        createdAt: row.created_at.toISOString(),
        description: row.description,
        consistencyScore: row.consistency_score ? parseFloat(row.consistency_score) : undefined,
        driftFromBase: row.drift_from_base ? parseFloat(row.drift_from_base) : undefined,
    };
}

/**
 * 错误处理
 */
export function characterDocumentError(error: any): { status: number; message: string } | null {
    if (error instanceof Error) {
        if (error.message === "CHARACTER_ID_EXISTS") {
            return { status: 409, message: "角色 ID 已存在" };
        }
        if (error.message === "CHARACTER_NOT_FOUND") {
            return { status: 404, message: "角色不存在" };
        }
        if (error.message === "VERSION_NOT_FOUND") {
            return { status: 404, message: "版本不存在" };
        }
    }
    return null;
}
