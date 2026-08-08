import { randomUUID } from "node:crypto";

import type { QueryExecutor } from "@/lib/server/database/postgres";

import { jsonValue, numberValue, stringValue } from "./repository-utils";

export type DigitalHumanAssetStatus = "pending" | "ready" | "disabled" | "error";
export type DigitalHumanTaskStatus = "pending" | "running" | "success" | "error" | "cancelled";

export type DigitalHumanAvatarRecord = Readonly<{
    id: string;
    tenantId: string;
    userId: string;
    name: string;
    source: "official" | "mine";
    gender: string;
    scene: string;
    coverUri: string;
    mediaUri: string;
    mediaType: string;
    storageScope: string;
    provider: string;
    providerAssetId: string;
    status: DigitalHumanAssetStatus;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}>;

export type DigitalHumanVoiceRecord = Readonly<{
    id: string;
    tenantId: string;
    userId: string;
    name: string;
    source: "official" | "mine";
    gender: string;
    ageGroup: string;
    coverUri: string;
    audioUri: string;
    previewAudioUri: string;
    storageScope: string;
    durationSeconds: number;
    provider: string;
    providerAssetId: string;
    status: DigitalHumanAssetStatus;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}>;

export type DigitalHumanTaskRecord = Readonly<{
    id: string;
    tenantId: string;
    userId: string;
    avatarId: string;
    voiceId: string;
    title: string;
    scriptText: string;
    prompt: string;
    mode: string;
    ratio: string;
    durationSeconds: number;
    provider: string;
    model: string;
    providerTaskId: string;
    providerStage: string;
    providerPayload: ReturnType<typeof jsonValue>;
    status: DigitalHumanTaskStatus;
    progress: number;
    error: string;
    resultPayload: ReturnType<typeof jsonValue>;
    createdAt: string;
    updatedAt: string;
    finishedAt?: string;
}>;

export type DigitalHumanResultRecord = Readonly<{
    id: string;
    tenantId: string;
    taskId: string;
    userId: string;
    avatarId: string;
    voiceId: string;
    title: string;
    coverUri: string;
    videoUri: string;
    storageScope: string;
    width: number;
    height: number;
    durationSeconds: number;
    providerTaskId: string;
    createdAt: string;
}>;

export type SaveDigitalHumanAvatarInput = Readonly<{
    id?: string;
    tenantId: string;
    userId: string;
    name: string;
    gender?: string;
    scene?: string;
    coverUri?: string;
    mediaUri: string;
    mediaType?: string;
}>;

export type SaveDigitalHumanVoiceInput = Readonly<{
    id?: string;
    tenantId: string;
    userId: string;
    name: string;
    gender?: string;
    ageGroup?: string;
    coverUri?: string;
    audioUri: string;
    previewAudioUri?: string;
    durationSeconds?: number;
}>;

export type CreateDigitalHumanTaskInput = Readonly<{
    id?: string;
    tenantId: string;
    userId: string;
    avatarId: string;
    voiceId: string;
    title: string;
    scriptText: string;
    prompt?: string;
    mode?: string;
    ratio?: string;
    provider?: string;
    model?: string;
    providerPayload?: Record<string, unknown>;
}>;

export type UpdateDigitalHumanRuntimeTaskInput = Readonly<{
    providerStage?: string;
    providerTaskId?: string;
    providerPayload?: Record<string, unknown>;
    status?: "pending" | "running";
    progress?: number;
    error?: string;
}>;

export class DigitalHumanRepository {
    constructor(private readonly db: QueryExecutor) {}

    async listAvatars(tenantId: string, userId: string) {
        const result = await this.db.query(
            `SELECT *
             FROM digital_human_avatars
             WHERE tenant_id = $1
               AND deleted_at IS NULL
               AND (source = 'official' OR user_id = $2)
             ORDER BY CASE WHEN source = 'official' THEN 0 ELSE 1 END, sort_order ASC, created_at DESC`,
            [tenantId, userId],
        );
        return result.rows.map(mapAvatar);
    }

    async saveAvatar(input: SaveDigitalHumanAvatarInput) {
        const id = input.id || randomUUID();
        const result = await this.db.query(
            `INSERT INTO digital_human_avatars (
                 id, tenant_id, user_id, name, source, gender, scene, cover_uri, media_uri, media_type, storage_scope, status
             )
             VALUES ($1, $2, $3, $4, 'mine', $5, $6, $7, $8, $9, 'tenant', 'ready')
             ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 gender = EXCLUDED.gender,
                 scene = EXCLUDED.scene,
                 cover_uri = EXCLUDED.cover_uri,
                 media_uri = EXCLUDED.media_uri,
                 media_type = EXCLUDED.media_type,
                 deleted_at = NULL,
                 updated_at = now()
             WHERE digital_human_avatars.tenant_id = EXCLUDED.tenant_id
               AND digital_human_avatars.user_id = EXCLUDED.user_id
             RETURNING *`,
            [id, input.tenantId, input.userId, input.name, input.gender || "", input.scene || "", input.coverUri || "", input.mediaUri, input.mediaType || "image"],
        );
        if (!result.rows[0]) throw new Error("Digital human avatar could not be saved");
        return mapAvatar(result.rows[0]);
    }

    async listVoices(tenantId: string, userId: string) {
        const result = await this.db.query(
            `SELECT *
             FROM digital_human_voices
             WHERE tenant_id = $1
               AND deleted_at IS NULL
               AND (source = 'official' OR user_id = $2)
             ORDER BY CASE WHEN source = 'official' THEN 0 ELSE 1 END, sort_order ASC, created_at DESC`,
            [tenantId, userId],
        );
        return result.rows.map(mapVoice);
    }

    async saveVoice(input: SaveDigitalHumanVoiceInput) {
        const id = input.id || randomUUID();
        const result = await this.db.query(
            `INSERT INTO digital_human_voices (
                 id, tenant_id, user_id, name, source, gender, age_group, cover_uri, audio_uri, preview_audio_uri, storage_scope, duration_seconds, status
             )
             VALUES ($1, $2, $3, $4, 'mine', $5, $6, $7, $8, $9, 'tenant', $10, 'ready')
             ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 gender = EXCLUDED.gender,
                 age_group = EXCLUDED.age_group,
                 cover_uri = EXCLUDED.cover_uri,
                 audio_uri = EXCLUDED.audio_uri,
                 preview_audio_uri = EXCLUDED.preview_audio_uri,
                 duration_seconds = EXCLUDED.duration_seconds,
                 deleted_at = NULL,
                 updated_at = now()
             WHERE digital_human_voices.tenant_id = EXCLUDED.tenant_id
               AND digital_human_voices.user_id = EXCLUDED.user_id
             RETURNING *`,
            [id, input.tenantId, input.userId, input.name, input.gender || "", input.ageGroup || "", input.coverUri || "", input.audioUri, input.previewAudioUri || "", Math.max(0, Math.floor(input.durationSeconds || 0))],
        );
        if (!result.rows[0]) throw new Error("Digital human voice could not be saved");
        return mapVoice(result.rows[0]);
    }

    async createTask(input: CreateDigitalHumanTaskInput) {
        const assetResult = await this.db.query(
            `SELECT a.id AS avatar_id, v.id AS voice_id
             FROM digital_human_avatars a
             JOIN digital_human_voices v
               ON v.tenant_id = a.tenant_id
              AND v.id = $3
              AND v.deleted_at IS NULL
              AND (v.source = 'official' OR v.user_id = $2)
             WHERE a.tenant_id = $1
               AND a.id = $4
               AND a.deleted_at IS NULL
               AND (a.source = 'official' OR a.user_id = $2)
             LIMIT 1`,
            [input.tenantId, input.userId, input.voiceId, input.avatarId],
        );
        if (!assetResult.rows[0]) throw new Error("Digital human avatar or voice is not available to this user");

        const id = input.id || randomUUID();
        const result = await this.db.query(
            `INSERT INTO digital_human_tasks (
                 id, tenant_id, user_id, avatar_id, voice_id, title, script_text, prompt, mode, ratio, provider, model, provider_payload, provider_stage
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, 'queued')
             RETURNING *`,
            [
                id,
                input.tenantId,
                input.userId,
                input.avatarId,
                input.voiceId,
                input.title,
                input.scriptText,
                input.prompt || "",
                input.mode || "standard",
                input.ratio || "16:9",
                input.provider || "mock",
                input.model || "digital-human",
                JSON.stringify(input.providerPayload || {}),
            ],
        );
        if (!result.rows[0]) throw new Error("Digital human task could not be created");
        return mapTask(result.rows[0]);
    }

    async listTasks(tenantId: string, userId: string, limit = 50) {
        const result = await this.db.query(
            `SELECT *
             FROM digital_human_tasks
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
             FROM digital_human_tasks
             WHERE tenant_id = $1 AND user_id = $2 AND id = $3 AND deleted_at IS NULL`,
            [tenantId, userId, id],
        );
        return result.rows[0] ? mapTask(result.rows[0]) : null;
    }

    async getRuntimeTask(tenantId: string, id: string) {
        const result = await this.db.query(
            `SELECT t.*,
                    a.media_uri AS avatar_media_url,
                    v.audio_uri AS voice_media_url,
                    v.provider_asset_id AS voice_provider_asset_id
             FROM digital_human_tasks t
             JOIN digital_human_avatars a
               ON a.tenant_id = t.tenant_id
              AND a.id = t.avatar_id
              AND a.deleted_at IS NULL
             JOIN digital_human_voices v
               ON v.tenant_id = t.tenant_id
              AND v.id = t.voice_id
              AND v.deleted_at IS NULL
             WHERE t.tenant_id = $1
               AND t.id = $2
               AND t.deleted_at IS NULL`,
            [tenantId, id],
        );
        if (!result.rows[0]) return null;
        const task = mapTask(result.rows[0]);
        return {
            id: task.id,
            tenantId: task.tenantId,
            userId: task.userId,
            scriptText: task.scriptText,
            prompt: task.prompt,
            mode: task.mode,
            providerStage: task.providerStage,
            providerTaskId: task.providerTaskId,
            providerPayload: objectValue(task.providerPayload),
            avatarMediaUrl: stringValue(result.rows[0].avatar_media_url),
            voiceMediaUrl: stringValue(result.rows[0].voice_media_url),
            voiceProviderAssetId: stringValue(result.rows[0].voice_provider_asset_id),
        };
    }

    async updateRuntimeTask(tenantId: string, id: string, input: UpdateDigitalHumanRuntimeTaskInput) {
        const result = await this.db.query(
            `UPDATE digital_human_tasks
             SET provider_stage = COALESCE($3, provider_stage),
                 provider_task_id = COALESCE($4, provider_task_id),
                 provider_payload = COALESCE($5::jsonb, provider_payload),
                 status = COALESCE($6, status),
                 progress = COALESCE($7, progress),
                 error = COALESCE($8, error),
                 updated_at = now()
             WHERE tenant_id = $1
               AND id = $2
               AND deleted_at IS NULL
               AND status IN ('pending', 'running')
             RETURNING *`,
            [
                tenantId,
                id,
                input.providerStage ?? null,
                input.providerTaskId ?? null,
                input.providerPayload ? JSON.stringify(input.providerPayload) : null,
                input.status ?? null,
                input.progress === undefined ? null : Math.max(0, Math.min(100, Math.floor(input.progress))),
                input.error ?? null,
            ],
        );
        if (!result.rows[0]) throw new Error("Digital human runtime task could not be updated");
        return mapTask(result.rows[0]);
    }

    async completeRuntimeTask(tenantId: string, id: string, videoUrl: string, payload: Record<string, unknown>) {
        const result = await this.db.query(
            `WITH source AS (
                 SELECT t.*, COALESCE(NULLIF(a.cover_uri, ''), a.media_uri, '') AS result_cover_uri
                 FROM digital_human_tasks t
                 LEFT JOIN digital_human_avatars a
                   ON a.tenant_id = t.tenant_id
                  AND a.id = t.avatar_id
                 WHERE t.tenant_id = $1
                   AND t.id = $2
                   AND t.deleted_at IS NULL
             ),
             saved_result AS (
                 INSERT INTO digital_human_results (
                     id, tenant_id, task_id, user_id, avatar_id, voice_id, title, cover_uri, video_uri,
                     storage_scope, duration_seconds, provider_task_id
                 )
                 SELECT id, tenant_id, id, user_id, avatar_id, voice_id, title, result_cover_uri, $3,
                        'provider', duration_seconds, provider_task_id
                 FROM source
                 ON CONFLICT (id) DO UPDATE SET
                     cover_uri = EXCLUDED.cover_uri,
                     video_uri = EXCLUDED.video_uri,
                     duration_seconds = EXCLUDED.duration_seconds,
                     provider_task_id = EXCLUDED.provider_task_id,
                     deleted_at = NULL
                 RETURNING id
             )
             UPDATE digital_human_tasks
             SET provider_stage = 'succeeded',
                 provider_payload = $4::jsonb,
                 result_payload = $4::jsonb,
                 status = 'success',
                 progress = 100,
                 error = '',
                 finished_at = now(),
                 updated_at = now()
             WHERE tenant_id = $1
               AND id = $2
               AND EXISTS (SELECT 1 FROM saved_result)
             RETURNING *`,
            [tenantId, id, videoUrl, JSON.stringify(payload)],
        );
        if (!result.rows[0]) throw new Error("Digital human result could not be persisted");
        return mapTask(result.rows[0]);
    }

    async failRuntimeTask(tenantId: string, id: string, message: string, payload: Record<string, unknown>) {
        const result = await this.db.query(
            `UPDATE digital_human_tasks
             SET provider_stage = 'failed',
                 provider_payload = $4::jsonb,
                 result_payload = $4::jsonb,
                 status = 'error',
                 error = $3,
                 finished_at = now(),
                 updated_at = now()
             WHERE tenant_id = $1
               AND id = $2
               AND deleted_at IS NULL
             RETURNING *`,
            [tenantId, id, message.slice(0, 500), JSON.stringify(payload)],
        );
        if (!result.rows[0]) throw new Error("Digital human task failure could not be persisted");
        return mapTask(result.rows[0]);
    }

    async listResults(tenantId: string, userId: string, limit = 50) {
        const result = await this.db.query(
            `SELECT *
             FROM digital_human_results
             WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT $3`,
            [tenantId, userId, Math.min(100, Math.max(1, Math.floor(limit)))],
        );
        return result.rows.map(mapResult);
    }
}

function mapAvatar(row: Record<string, unknown>): DigitalHumanAvatarRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        userId: stringValue(row.user_id),
        name: stringValue(row.name),
        source: row.source === "official" ? "official" : "mine",
        gender: stringValue(row.gender),
        scene: stringValue(row.scene),
        coverUri: stringValue(row.cover_uri),
        mediaUri: stringValue(row.media_uri),
        mediaType: stringValue(row.media_type),
        storageScope: stringValue(row.storage_scope),
        provider: stringValue(row.provider),
        providerAssetId: stringValue(row.provider_asset_id),
        status: assetStatusValue(row.status),
        sortOrder: numberValue(row.sort_order),
        createdAt: new Date(stringValue(row.created_at)).toISOString(),
        updatedAt: new Date(stringValue(row.updated_at)).toISOString(),
    };
}

function mapVoice(row: Record<string, unknown>): DigitalHumanVoiceRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        userId: stringValue(row.user_id),
        name: stringValue(row.name),
        source: row.source === "official" ? "official" : "mine",
        gender: stringValue(row.gender),
        ageGroup: stringValue(row.age_group),
        coverUri: stringValue(row.cover_uri),
        audioUri: stringValue(row.audio_uri),
        previewAudioUri: stringValue(row.preview_audio_uri),
        storageScope: stringValue(row.storage_scope),
        durationSeconds: numberValue(row.duration_seconds),
        provider: stringValue(row.provider),
        providerAssetId: stringValue(row.provider_asset_id),
        status: assetStatusValue(row.status),
        sortOrder: numberValue(row.sort_order),
        createdAt: new Date(stringValue(row.created_at)).toISOString(),
        updatedAt: new Date(stringValue(row.updated_at)).toISOString(),
    };
}

function mapTask(row: Record<string, unknown>): DigitalHumanTaskRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        userId: stringValue(row.user_id),
        avatarId: stringValue(row.avatar_id),
        voiceId: stringValue(row.voice_id),
        title: stringValue(row.title),
        scriptText: stringValue(row.script_text),
        prompt: stringValue(row.prompt),
        mode: stringValue(row.mode),
        ratio: stringValue(row.ratio),
        durationSeconds: numberValue(row.duration_seconds),
        provider: stringValue(row.provider),
        model: stringValue(row.model),
        providerTaskId: stringValue(row.provider_task_id),
        providerStage: stringValue(row.provider_stage),
        providerPayload: jsonValue(row.provider_payload),
        status: taskStatusValue(row.status),
        progress: numberValue(row.progress),
        error: stringValue(row.error),
        resultPayload: jsonValue(row.result_payload),
        createdAt: new Date(stringValue(row.created_at)).toISOString(),
        updatedAt: new Date(stringValue(row.updated_at)).toISOString(),
        ...(row.finished_at ? { finishedAt: new Date(stringValue(row.finished_at)).toISOString() } : {}),
    };
}

function mapResult(row: Record<string, unknown>): DigitalHumanResultRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        taskId: stringValue(row.task_id),
        userId: stringValue(row.user_id),
        avatarId: stringValue(row.avatar_id),
        voiceId: stringValue(row.voice_id),
        title: stringValue(row.title),
        coverUri: stringValue(row.cover_uri),
        videoUri: stringValue(row.video_uri),
        storageScope: stringValue(row.storage_scope),
        width: numberValue(row.width),
        height: numberValue(row.height),
        durationSeconds: numberValue(row.duration_seconds),
        providerTaskId: stringValue(row.provider_task_id),
        createdAt: new Date(stringValue(row.created_at)).toISOString(),
    };
}

function assetStatusValue(value: unknown): DigitalHumanAssetStatus {
    return value === "pending" || value === "disabled" || value === "error" ? value : "ready";
}

function taskStatusValue(value: unknown): DigitalHumanTaskStatus {
    return value === "running" || value === "success" || value === "error" || value === "cancelled" ? value : "pending";
}

function objectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
