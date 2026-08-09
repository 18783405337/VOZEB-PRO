import { randomUUID } from "node:crypto";

import type { QueryExecutor } from "@/lib/server/database/postgres";

import { isoValue, jsonParam, jsonValue, numberValue, stringValue } from "./repository-utils";

export type SmartClipType = "realman_broadcast" | "broadcast_mixcut" | "news_mixcut";
export type SmartClipTaskStatus = "pending" | "running" | "success" | "error" | "cancelled";

export type SmartClipConfigRecord = Readonly<{
    id: string;
    tenantId: string;
    provider: string;
    model: string;
    config: ReturnType<typeof jsonValue>;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}>;

export type SmartClipTemplateRecord = Readonly<{
    id: string;
    clipType: SmartClipType;
    name: string;
    scene: string;
    description: string;
    defaultRatio: string;
    defaultDurationSeconds: number;
}>;

export type SmartClipTaskRecord = Readonly<{
    id: string;
    tenantId: string;
    userId: string;
    clipType: SmartClipType;
    scene: string;
    styleId: string;
    title: string;
    videoUri: string;
    audioUri: string;
    materials: ReturnType<typeof jsonValue>;
    introduceCard: ReturnType<typeof jsonValue>;
    packRules: ReturnType<typeof jsonValue>;
    processRules: ReturnType<typeof jsonValue>;
    structLayers: ReturnType<typeof jsonValue>;
    subtitle: ReturnType<typeof jsonValue>;
    language: string;
    sourceApp: string;
    sourceResultId: string;
    channel: string;
    quality: string;
    ratio: string;
    durationSeconds: number;
    quantity: number;
    tenantCostPoints: number;
    userChargePoints: number;
    provider: string;
    model: string;
    providerTaskId: string;
    providerPayload: ReturnType<typeof jsonValue>;
    status: SmartClipTaskStatus;
    progress: number;
    error: string;
    createdAt: string;
    updatedAt: string;
    finishedAt?: string;
}>;

export type SmartClipResultRecord = Readonly<{
    id: string;
    tenantId: string;
    taskId: string;
    userId: string;
    clipType: SmartClipType;
    styleId: string;
    title: string;
    coverUri: string;
    videoUri: string;
    storageScope: string;
    durationSeconds: number;
    costs: number;
    providerTaskId: string;
    result: ReturnType<typeof jsonValue>;
    createdAt: string;
}>;

export type CreateSmartClipTaskInput = Readonly<{
    id?: string;
    tenantId: string;
    userId: string;
    clipType: SmartClipType;
    scene: string;
    styleId: string;
    title: string;
    videoUri: string;
    audioUri: string;
    materials: ReturnType<typeof jsonValue>;
    introduceCard: ReturnType<typeof jsonValue>;
    packRules: ReturnType<typeof jsonValue>;
    processRules: ReturnType<typeof jsonValue>;
    structLayers: ReturnType<typeof jsonValue>;
    subtitle: ReturnType<typeof jsonValue>;
    language: string;
    sourceApp: string;
    sourceResultId: string;
    channel: string;
    quality: string;
    ratio: string;
    durationSeconds: number;
    quantity: number;
}>;

const TEMPLATES: SmartClipTemplateRecord[] = [
    {
        id: "realman-broadcast-default",
        clipType: "realman_broadcast",
        name: "真人口播混剪",
        scene: "realMan",
        description: "将真人口播与素材自动组合成短视频。",
        defaultRatio: "duration",
        defaultDurationSeconds: 60,
    },
    {
        id: "broadcast-mixcut-default",
        clipType: "broadcast_mixcut",
        name: "素材混剪",
        scene: "oralMixCutting",
        description: "按素材顺序和包装规则生成混剪视频。",
        defaultRatio: "duration",
        defaultDurationSeconds: 60,
    },
    {
        id: "news-mixcut-default",
        clipType: "news_mixcut",
        name: "新闻体视频",
        scene: "newsMixCutting",
        description: "按新闻体结构组织标题、字幕和画面素材。",
        defaultRatio: "duration",
        defaultDurationSeconds: 90,
    },
];

export class SmartClipRepository {
    constructor(private readonly db: QueryExecutor) {}

    async getConfig(tenantId: string): Promise<SmartClipConfigRecord> {
        const result = await this.db.query("SELECT * FROM smart_clip_configs WHERE tenant_id = $1 LIMIT 1", [tenantId]);
        return result.rows[0] ? mapConfig(result.rows[0]) : defaultConfig(tenantId);
    }

    async updateConfig(tenantId: string, input: Readonly<{ provider: string; model: string; config: Record<string, unknown>; enabled: boolean }>) {
        const safeConfig = Object.fromEntries(Object.entries(input.config).filter(([key]) => !/^(apiKey|api_key|secret|token)$/i.test(key)));
        const result = await this.db.query(
            `INSERT INTO smart_clip_configs (id, tenant_id, provider, model, config_json, enabled)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)
             ON CONFLICT (tenant_id) DO UPDATE SET provider = EXCLUDED.provider, model = EXCLUDED.model, config_json = EXCLUDED.config_json, enabled = EXCLUDED.enabled, updated_at = now()
             RETURNING *`,
            [input.provider === "mock" ? `${tenantId}:smart-clip` : `${tenantId}:smart-clip`, tenantId, input.provider.trim() || "mock", input.model.trim() || "smart-clip", JSON.stringify(safeConfig), input.enabled === true],
        );
        return result.rows[0] ? mapConfig(result.rows[0]) : defaultConfig(tenantId);
    }

    listTemplates(clipType?: SmartClipType) {
        return clipType ? TEMPLATES.filter((item) => item.clipType === clipType) : TEMPLATES;
    }

    async createTask(input: CreateSmartClipTaskInput) {
        const id = input.id || randomUUID();
        const config = await this.getConfig(input.tenantId);
        const provider = config.enabled ? config.provider : "mock";
        const model = config.enabled ? config.model : "smart-clip";
        const result = await this.db.query(
            `INSERT INTO smart_clip_tasks (
                 id, tenant_id, user_id, clip_type, scene, style_id, title, video_uri, audio_uri,
                 materials_json, introduce_card_json, pack_rules_json, process_rules_json, struct_layers_json,
                 subtitle_json, language, source_app, source_result_id, channel, quality, ratio,
                 duration_seconds, quantity, provider, model
             )
             VALUES (
                 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                 $17, $18, $19, $20, $21, $22, $23, $24, $25
             )
             RETURNING *`,
            [
                id,
                input.tenantId,
                input.userId,
                input.clipType,
                input.scene,
                input.styleId,
                input.title,
                input.videoUri,
                input.audioUri,
                jsonParam(input.materials),
                jsonParam(input.introduceCard),
                jsonParam(input.packRules),
                jsonParam(input.processRules),
                jsonParam(input.structLayers),
                jsonParam(input.subtitle),
                input.language,
                input.sourceApp,
                input.sourceResultId,
                input.channel,
                input.quality,
                input.ratio,
                input.durationSeconds,
                input.quantity,
                provider,
                model,
            ],
        );
        if (!result.rows[0]) throw new Error("Smart clip task could not be created");
        return mapTask(result.rows[0]);
    }

    async listTasks(tenantId: string, userId: string, limit = 50) {
        const result = await this.db.query(
            `SELECT *
             FROM smart_clip_tasks
             WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL
             ORDER BY updated_at DESC
             LIMIT $3`,
            [tenantId, userId, Math.min(100, Math.max(1, Math.floor(limit)))],
        );
        return result.rows.map(mapTask);
    }

    async getTask(tenantId: string, userId: string, id: string) {
        const result = await this.db.query(
            `SELECT *
             FROM smart_clip_tasks
             WHERE tenant_id = $1 AND user_id = $2 AND id = $3 AND deleted_at IS NULL`,
            [tenantId, userId, id],
        );
        return result.rows[0] ? mapTask(result.rows[0]) : null;
    }

    async updateTask(tenantId: string, userId: string, id: string, patch: Readonly<Record<string, unknown>>) {
        const result = await this.db.query(
            `UPDATE smart_clip_tasks
             SET provider_task_id = COALESCE($4, provider_task_id), provider_payload = COALESCE($5::jsonb, provider_payload),
                 status = COALESCE($6, status), progress = COALESCE($7, progress), error = COALESCE($8, error),
                 finished_at = COALESCE($9, finished_at), updated_at = now()
             WHERE tenant_id = $1 AND user_id = $2 AND id = $3 AND deleted_at IS NULL
             RETURNING *`,
            [tenantId, userId, id, stringOrNull(patch.providerTaskId), patch.providerPayload ? JSON.stringify(patch.providerPayload) : null, stringOrNull(patch.status), numberOrNull(patch.progress), stringOrNull(patch.error), patch.finishedAt ? new Date(Number(patch.finishedAt)) : null],
        );
        return result.rows[0] ? mapTask(result.rows[0]) : null;
    }

    async createResult(input: Readonly<{ tenantId: string; userId: string; taskId: string; clipType: SmartClipType; styleId: string; title: string; videoUri: string; providerTaskId: string; result?: unknown; durationSeconds?: number; costs?: number }>) {
        const result = await this.db.query(
            `INSERT INTO smart_clip_results (id, tenant_id, task_id, user_id, clip_type, style_id, title, video_uri, duration_seconds, costs, provider_task_id, result_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb) RETURNING *`,
            [randomUUID(), input.tenantId, input.taskId, input.userId, input.clipType, input.styleId, input.title, input.videoUri, input.durationSeconds || 0, input.costs || 0, input.providerTaskId, JSON.stringify(input.result || {})],
        );
        return result.rows[0] ? mapResult(result.rows[0]) : null;
    }

    async listResults(tenantId: string, userId: string, limit = 50) {
        const result = await this.db.query(
            `SELECT *
             FROM smart_clip_results
             WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT $3`,
            [tenantId, userId, Math.min(100, Math.max(1, Math.floor(limit)))],
        );
        return result.rows.map(mapResult);
    }

    async deleteResult(tenantId: string, userId: string, id: string) {
        const result = await this.db.query(
            `UPDATE smart_clip_results
             SET deleted_at = now()
             WHERE tenant_id = $1 AND user_id = $2 AND id = $3 AND deleted_at IS NULL
             RETURNING id`,
            [tenantId, userId, id],
        );
        return Boolean(result.rows[0]);
    }

    estimate(input: Pick<CreateSmartClipTaskInput, "durationSeconds" | "quantity">) {
        const duration = Math.max(1, Math.floor(input.durationSeconds || 0));
        const quantity = Math.max(1, Math.floor(input.quantity || 1));
        const tenantCostPoints = Number((duration * quantity * 0.02).toFixed(2));
        return { durationSeconds: duration, quantity, tenantCostPoints, userChargePoints: tenantCostPoints };
    }
}

function defaultConfig(tenantId: string): SmartClipConfigRecord {
    const now = new Date().toISOString();
    return {
        id: "",
        tenantId,
        provider: "mock",
        model: "smart-clip",
        config: {},
        enabled: true,
        createdAt: now,
        updatedAt: now,
    };
}

function mapConfig(row: Record<string, unknown>): SmartClipConfigRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        provider: stringValue(row.provider) || "mock",
        model: stringValue(row.model) || "smart-clip",
        config: jsonValue(row.config_json),
        enabled: row.enabled !== false,
        createdAt: isoValue(row.created_at),
        updatedAt: isoValue(row.updated_at),
    };
}

function mapTask(row: Record<string, unknown>): SmartClipTaskRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        userId: stringValue(row.user_id),
        clipType: smartClipTypeValue(row.clip_type),
        scene: stringValue(row.scene),
        styleId: stringValue(row.style_id),
        title: stringValue(row.title),
        videoUri: stringValue(row.video_uri),
        audioUri: stringValue(row.audio_uri),
        materials: jsonValue(row.materials_json),
        introduceCard: jsonValue(row.introduce_card_json),
        packRules: jsonValue(row.pack_rules_json),
        processRules: jsonValue(row.process_rules_json),
        structLayers: jsonValue(row.struct_layers_json),
        subtitle: jsonValue(row.subtitle_json),
        language: stringValue(row.language),
        sourceApp: stringValue(row.source_app),
        sourceResultId: stringValue(row.source_result_id),
        channel: stringValue(row.channel),
        quality: stringValue(row.quality),
        ratio: stringValue(row.ratio),
        durationSeconds: numberValue(row.duration_seconds),
        quantity: numberValue(row.quantity) || 1,
        tenantCostPoints: numberValue(row.tenant_cost_points),
        userChargePoints: numberValue(row.user_charge_points),
        provider: stringValue(row.provider),
        model: stringValue(row.model),
        providerTaskId: stringValue(row.provider_task_id),
        providerPayload: jsonValue(row.provider_payload),
        status: smartClipTaskStatusValue(row.status),
        progress: numberValue(row.progress),
        error: stringValue(row.error),
        createdAt: isoValue(row.created_at),
        updatedAt: isoValue(row.updated_at),
        finishedAt: row.finished_at ? isoValue(row.finished_at) : undefined,
    };
}

function mapResult(row: Record<string, unknown>): SmartClipResultRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        taskId: stringValue(row.task_id),
        userId: stringValue(row.user_id),
        clipType: smartClipTypeValue(row.clip_type),
        styleId: stringValue(row.style_id),
        title: stringValue(row.title),
        coverUri: stringValue(row.cover_uri),
        videoUri: stringValue(row.video_uri),
        storageScope: stringValue(row.storage_scope),
        durationSeconds: numberValue(row.duration_seconds),
        costs: numberValue(row.costs),
        providerTaskId: stringValue(row.provider_task_id),
        result: jsonValue(row.result_json),
        createdAt: isoValue(row.created_at),
    };
}

function stringOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : null;
}

function smartClipTypeValue(value: unknown): SmartClipType {
    return value === "realman_broadcast" || value === "news_mixcut" ? value : "broadcast_mixcut";
}

function smartClipTaskStatusValue(value: unknown): SmartClipTaskStatus {
    return value === "running" || value === "success" || value === "error" || value === "cancelled" ? value : "pending";
}
