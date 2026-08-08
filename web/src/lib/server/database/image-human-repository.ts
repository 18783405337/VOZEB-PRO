import { randomUUID } from "node:crypto";

import type { QueryExecutor } from "@/lib/server/database/postgres";

import { jsonValue, numberValue, stringValue } from "./repository-utils";

export type ImageHumanTaskStatus = "pending" | "running" | "success" | "error" | "cancelled";

export type ImageHumanTaskRecord = Readonly<{
    id: string;
    tenantId: string;
    userId: string;
    title: string;
    sourceImageUri: string;
    referenceAudioUri: string;
    scriptText: string;
    prompt: string;
    mode: string;
    durationSeconds: number;
    provider: string;
    model: string;
    providerTaskId: string;
    providerStage: string;
    providerPayload: ReturnType<typeof jsonValue>;
    status: ImageHumanTaskStatus;
    progress: number;
    error: string;
    resultPayload: ReturnType<typeof jsonValue>;
    createdAt: string;
    updatedAt: string;
    finishedAt?: string;
}>;

export type ImageHumanResultRecord = Readonly<{
    id: string;
    tenantId: string;
    taskId: string;
    userId: string;
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

export type CreateImageHumanTaskInput = Readonly<{
    id?: string;
    tenantId: string;
    userId: string;
    title?: string;
    sourceImageUri: string;
    referenceAudioUri: string;
    scriptText?: string;
    prompt?: string;
    mode?: string;
    durationSeconds?: number;
    provider?: string;
    model?: string;
    providerPayload?: Record<string, unknown>;
}>;

export type UpdateImageHumanRuntimeTaskInput = Readonly<{
    providerStage?: string;
    providerTaskId?: string;
    providerPayload?: Record<string, unknown>;
    status?: "pending" | "running";
    progress?: number;
    error?: string;
}>;

export class ImageHumanRepository {
    constructor(private readonly db: QueryExecutor) {}

    async createTask(input: CreateImageHumanTaskInput) {
        const id = input.id || randomUUID();
        const result = await this.db.query(
            `INSERT INTO image_human_tasks (
                 id, tenant_id, user_id, title, source_image_uri, reference_audio_uri, script_text,
                 prompt, mode, duration_seconds, provider, model, provider_payload, provider_stage
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, 'queued')
             RETURNING *`,
            [
                id,
                input.tenantId,
                input.userId,
                input.title || "",
                input.sourceImageUri,
                input.referenceAudioUri,
                input.scriptText || "",
                input.prompt || "",
                input.mode || "standard",
                Math.max(0, Math.floor(input.durationSeconds || 0)),
                input.provider || "mock",
                input.model || "image-human",
                JSON.stringify(input.providerPayload || {}),
            ],
        );
        if (!result.rows[0]) throw new Error("Image human task could not be created");
        return mapTask(result.rows[0]);
    }

    async listTasks(tenantId: string, userId: string, limit = 50) {
        const result = await this.db.query(
            `SELECT *
             FROM image_human_tasks
             WHERE tenant_id = $1
               AND user_id = $2
               AND deleted_at IS NULL
             ORDER BY updated_at DESC
             LIMIT $3`,
            [tenantId, userId, boundedLimit(limit)],
        );
        return result.rows.map(mapTask);
    }

    async getTask(tenantId: string, userId: string, id: string) {
        const result = await this.db.query(
            `SELECT *
             FROM image_human_tasks
             WHERE tenant_id = $1
               AND user_id = $2
               AND id = $3
               AND deleted_at IS NULL`,
            [tenantId, userId, id],
        );
        return result.rows[0] ? mapTask(result.rows[0]) : null;
    }

    async getRuntimeTask(tenantId: string, userId: string, id: string) {
        const result = await this.db.query(
            `SELECT *
             FROM image_human_tasks
             WHERE tenant_id = $1
               AND user_id = $2
               AND id = $3
               AND deleted_at IS NULL`,
            [tenantId, userId, id],
        );
        if (!result.rows[0]) return null;
        const task = mapTask(result.rows[0]);
        return {
            id: task.id,
            tenantId: task.tenantId,
            userId: task.userId,
            imageUrl: task.sourceImageUri,
            audioUrl: task.referenceAudioUri,
            scriptText: task.scriptText,
            prompt: task.prompt,
            mode: task.mode,
            duration: task.durationSeconds,
            providerStage: task.providerStage,
            providerTaskId: task.providerTaskId,
            providerPayload: objectValue(task.providerPayload),
        };
    }

    async updateRuntimeTask(tenantId: string, userId: string, id: string, input: UpdateImageHumanRuntimeTaskInput) {
        const result = await this.db.query(
            `UPDATE image_human_tasks
             SET provider_stage = COALESCE($4, provider_stage),
                 provider_task_id = COALESCE($5, provider_task_id),
                 provider_payload = COALESCE($6::jsonb, provider_payload),
                 status = COALESCE($7, status),
                 progress = COALESCE($8, progress),
                 error = COALESCE($9, error),
                 updated_at = now()
             WHERE tenant_id = $1
               AND user_id = $2
               AND id = $3
               AND deleted_at IS NULL
               AND status IN ('pending', 'running')
             RETURNING *`,
            [
                tenantId,
                userId,
                id,
                input.providerStage ?? null,
                input.providerTaskId ?? null,
                input.providerPayload ? JSON.stringify(input.providerPayload) : null,
                input.status ?? null,
                input.progress === undefined ? null : Math.max(0, Math.min(100, Math.floor(input.progress))),
                input.error ?? null,
            ],
        );
        if (!result.rows[0]) throw new Error("Image human runtime task could not be updated");
        return mapTask(result.rows[0]);
    }

    async completeRuntimeTask(tenantId: string, userId: string, id: string, videoUrl: string, payload: Record<string, unknown>) {
        const result = await this.db.query(
            `WITH source AS (
                 SELECT *
                 FROM image_human_tasks
                 WHERE tenant_id = $1
                   AND user_id = $2
                   AND id = $3
                   AND deleted_at IS NULL
             ),
             saved_result AS (
                 INSERT INTO image_human_results (
                     id, tenant_id, task_id, user_id, title, cover_uri, video_uri, storage_scope,
                     duration_seconds, provider_task_id
                 )
                 SELECT id, tenant_id, id, user_id, title, source_image_uri, $4, 'provider',
                        duration_seconds, provider_task_id
                 FROM source
                 ON CONFLICT (id) DO UPDATE SET
                     title = EXCLUDED.title,
                     cover_uri = EXCLUDED.cover_uri,
                     video_uri = EXCLUDED.video_uri,
                     duration_seconds = EXCLUDED.duration_seconds,
                     provider_task_id = EXCLUDED.provider_task_id,
                     deleted_at = NULL
                 RETURNING id
             )
             UPDATE image_human_tasks
             SET provider_stage = 'succeeded',
                 provider_payload = $5::jsonb,
                 result_payload = $5::jsonb,
                 status = 'success',
                 progress = 100,
                 error = '',
                 finished_at = now(),
                 updated_at = now()
             WHERE tenant_id = $1
               AND user_id = $2
               AND id = $3
               AND EXISTS (SELECT 1 FROM saved_result)
             RETURNING *`,
            [tenantId, userId, id, videoUrl, JSON.stringify(payload)],
        );
        if (!result.rows[0]) throw new Error("Image human result could not be persisted");
        return mapTask(result.rows[0]);
    }

    async failRuntimeTask(tenantId: string, userId: string, id: string, message: string, payload: Record<string, unknown>) {
        const result = await this.db.query(
            `UPDATE image_human_tasks
             SET provider_stage = 'failed',
                 provider_payload = $5::jsonb,
                 result_payload = $5::jsonb,
                 status = 'error',
                 error = $4,
                 finished_at = now(),
                 updated_at = now()
             WHERE tenant_id = $1
               AND user_id = $2
               AND id = $3
               AND deleted_at IS NULL
             RETURNING *`,
            [tenantId, userId, id, message.slice(0, 500), JSON.stringify(payload)],
        );
        if (!result.rows[0]) throw new Error("Image human task failure could not be persisted");
        return mapTask(result.rows[0]);
    }

    async listResults(tenantId: string, userId: string, limit = 50) {
        const result = await this.db.query(
            `SELECT *
             FROM image_human_results
             WHERE tenant_id = $1
               AND user_id = $2
               AND deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT $3`,
            [tenantId, userId, boundedLimit(limit)],
        );
        return result.rows.map(mapResult);
    }
}

function mapTask(row: Record<string, unknown>): ImageHumanTaskRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        userId: stringValue(row.user_id),
        title: stringValue(row.title),
        sourceImageUri: stringValue(row.source_image_uri),
        referenceAudioUri: stringValue(row.reference_audio_uri),
        scriptText: stringValue(row.script_text),
        prompt: stringValue(row.prompt),
        mode: stringValue(row.mode),
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

function mapResult(row: Record<string, unknown>): ImageHumanResultRecord {
    return {
        id: stringValue(row.id),
        tenantId: stringValue(row.tenant_id),
        taskId: stringValue(row.task_id),
        userId: stringValue(row.user_id),
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

function taskStatusValue(value: unknown): ImageHumanTaskStatus {
    return value === "running" || value === "success" || value === "error" || value === "cancelled" ? value : "pending";
}

function objectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function boundedLimit(value: number) {
    return Math.min(100, Math.max(1, Math.floor(value)));
}
