import type { CanvasProject, CanvasProjectSummary, CanvasProjectSummaryPage } from "@/lib/canvas-project-contract";
import { summarizeCanvasProjectRecord } from "@/lib/canvas-project-summary";
import { summarizeCanvasProject, type CreateOverviewMedia, type CreateOverviewProject } from "@/lib/create-workbench-overview";
import { readJsonDataFile, withJsonDataFileLock, writeJsonDataFile } from "@/lib/server/data-adapter";
import { ensurePostgresSchema, getDatabaseProvider, postgresQuery } from "@/lib/server/database";

type CanvasProjectRecord = { userId: string; project: CanvasProject };
type CanvasProjectDatabase = { version: 1; projects: CanvasProjectRecord[] };

const FILE_NAME = "canvas-projects.json";
let mutationQueue = Promise.resolve();

export async function listCanvasProjects(userId: string) {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery<{ project_json: CanvasProject }>("SELECT project_json FROM canvas_projects WHERE user_id = $1 ORDER BY updated_at DESC", [userId]);
        return result.rows.map((row) => row.project_json);
    }
    return (await readDatabase()).projects
        .filter((record) => record.userId === userId)
        .map((record) => record.project)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listCanvasProjectSummaries(userId: string, input: { page: number; pageSize: number }): Promise<CanvasProjectSummaryPage> {
    const offset = (input.page - 1) * input.pageSize;
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery<Record<string, unknown>>(
            `WITH filtered AS (
                 SELECT id, title, created_at, updated_at,
                        project_json->>'sourceHandoffId' AS source_handoff_id,
                        project_json->>'creativeConversationId' AS creative_conversation_id,
                        jsonb_array_length(CASE WHEN jsonb_typeof(project_json->'nodes') = 'array' THEN project_json->'nodes' ELSE '[]'::jsonb END) AS node_count,
                        jsonb_array_length(CASE WHEN jsonb_typeof(project_json->'connections') = 'array' THEN project_json->'connections' ELSE '[]'::jsonb END) AS connection_count
                 FROM canvas_projects
                 WHERE user_id = $1
             ), page_items AS (
                 SELECT * FROM filtered ORDER BY updated_at DESC, id ASC LIMIT $2 OFFSET $3
             )
             SELECT page_items.*, totals.total_count
             FROM (SELECT count(*)::integer AS total_count FROM filtered) totals
             LEFT JOIN page_items ON TRUE
             ORDER BY page_items.updated_at DESC NULLS LAST, page_items.id ASC`,
            [userId, input.pageSize, offset],
        );
        return { projects: result.rows.filter((row) => row.id).map(mapProjectSummary), total: Math.max(0, Number(result.rows[0]?.total_count) || 0), ...input };
    }
    const projects = (await listCanvasProjects(userId)).map(summarizeCanvasProjectRecord);
    return { projects: projects.slice(offset, offset + input.pageSize), total: projects.length, ...input };
}

export async function getLatestCanvasProjectOverview(userId: string): Promise<CreateOverviewProject | undefined> {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery<Record<string, unknown>>(
            `
            SELECT
                id,
                title,
                updated_at,
                jsonb_array_length(CASE WHEN jsonb_typeof(project_json->'nodes') = 'array' THEN project_json->'nodes' ELSE '[]'::jsonb END) AS node_count,
                jsonb_array_length(CASE WHEN jsonb_typeof(project_json->'connections') = 'array' THEN project_json->'connections' ELSE '[]'::jsonb END) AS connection_count,
                COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('kind', preview.kind, 'url', preview.url) ORDER BY preview.status_order, preview.kind_order, preview.node_order, preview.url_order)
                    FROM (
                        SELECT
                            CASE WHEN node->>'type' = 'video' THEN 'video' ELSE 'image' END AS kind,
                            media.url,
                            CASE WHEN node->'metadata'->>'status' = 'success' THEN 0 ELSE 1 END AS status_order,
                            CASE WHEN node->>'type' IN ('image', 'panorama') THEN 0 ELSE 1 END AS kind_order,
                            node_order,
                            media.url_order
                        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(project_json->'nodes') = 'array' THEN project_json->'nodes' ELSE '[]'::jsonb END) WITH ORDINALITY AS project_node(node, node_order)
                        CROSS JOIN LATERAL (
                            VALUES
                                (node->'metadata'->>'serverUrl', 1),
                                (node->'metadata'->>'remoteUrl', 2),
                                (node->'metadata'->>'content', 3)
                        ) AS media(url, url_order)
                        WHERE node->>'type' IN ('image', 'panorama', 'video')
                          AND COALESCE(node->'metadata'->>'status', '') <> 'error'
                          AND COALESCE(btrim(media.url), '') <> ''
                          AND media.url !~* '^(data|blob):'
                        ORDER BY status_order, kind_order, node_order, media.url_order
                        LIMIT 18
                    ) preview
                ), '[]'::jsonb) AS previews
            FROM canvas_projects
            WHERE user_id = $1
            ORDER BY updated_at DESC
            LIMIT 1
            `,
            [userId],
        );
        return result.rows[0] ? mapPostgresOverview(result.rows[0]) : undefined;
    }
    const project = (await listCanvasProjects(userId))[0];
    return project ? summarizeCanvasProject(project) : undefined;
}

export async function getCanvasProject(id: string, userId: string) {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery<{ project_json: CanvasProject }>("SELECT project_json FROM canvas_projects WHERE id = $1 AND user_id = $2", [id, userId]);
        return result.rows[0]?.project_json || null;
    }
    return (await readDatabase()).projects.find((record) => record.userId === userId && record.project.id === id)?.project || null;
}

export async function createCanvasProject(userId: string, project: CanvasProject, tenantId = "default") {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        await postgresQuery(
            `INSERT INTO canvas_projects (id, tenant_id, user_id, title, project_json, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
            [project.id, tenantId, userId, project.title, JSON.stringify(project), new Date(project.createdAt), new Date(project.updatedAt)],
        );
        return project;
    }
    await mutateDatabase((db) => {
        if (db.projects.some((record) => record.project.id === project.id)) throw new CanvasProjectStoreError("画布项目已存在", 409);
        return { ...db, projects: [{ userId, project }, ...db.projects] };
    });
    return project;
}

export async function updateCanvasProject(userId: string, project: CanvasProject, expectedUpdatedAt: string) {
    if (getDatabaseProvider() === "postgres") {
        await ensurePostgresSchema();
        const result = await postgresQuery(
            `UPDATE canvas_projects SET title = $3, project_json = $4::jsonb, updated_at = $5
             WHERE id = $1 AND user_id = $2 AND project_json->>'updatedAt' = $6
             RETURNING id`,
            [project.id, userId, project.title, JSON.stringify(project), new Date(project.updatedAt), expectedUpdatedAt],
        );
        if (!result.rows[0]) {
            const existing = await getCanvasProject(project.id, userId);
            throw new CanvasProjectStoreError(existing ? "画布项目已在其他页面更新，请刷新后重试" : "画布项目不存在", existing ? 409 : 404);
        }
        return project;
    }
    let found = false;
    await mutateDatabase((db) => ({
        ...db,
        projects: db.projects.map((record) => {
            if (record.userId !== userId || record.project.id !== project.id) return record;
            found = true;
            if (record.project.updatedAt !== expectedUpdatedAt) throw new CanvasProjectStoreError("画布项目已在其他页面更新，请刷新后重试", 409);
            return { ...record, project };
        }),
    }));
    if (!found) throw new CanvasProjectStoreError("画布项目不存在", 404);
    return project;
}

function readDatabase() {
    return readJsonDataFile<CanvasProjectDatabase>(FILE_NAME, { version: 1, projects: [] });
}

function mutateDatabase(mutator: (database: CanvasProjectDatabase) => CanvasProjectDatabase) {
    const operation = mutationQueue.then(() => withJsonDataFileLock(FILE_NAME, async () => writeJsonDataFile(FILE_NAME, mutator(await readDatabase()))));
    mutationQueue = operation.catch(() => undefined);
    return operation;
}

function mapPostgresOverview(row: Record<string, unknown>): CreateOverviewProject {
    const previews = jsonArray(row.previews);
    const seen = new Set<string>();
    return {
        id: String(row.id || ""),
        title: String(row.title || ""),
        updatedAt: isoDate(row.updated_at),
        nodeCount: Math.max(0, Number(row.node_count) || 0),
        connectionCount: Math.max(0, Number(row.connection_count) || 0),
        previews: previews
            .flatMap((item): CreateOverviewMedia[] => {
                const source = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
                const kind = source.kind === "video" ? "video" : source.kind === "image" ? "image" : undefined;
                const url = typeof source.url === "string" ? source.url.trim() : "";
                if (!kind || !url || /^(data|blob):/i.test(url) || seen.has(url)) return [];
                seen.add(url);
                return [{ kind, url }];
            })
            .slice(0, 6),
    };
}

function mapProjectSummary(row: Record<string, unknown>): CanvasProjectSummary {
    const sourceHandoffId = String(row.source_handoff_id || "").trim();
    const creativeConversationId = String(row.creative_conversation_id || "").trim();
    return {
        id: String(row.id || ""),
        ...(sourceHandoffId ? { sourceHandoffId } : {}),
        ...(creativeConversationId ? { creativeConversationId } : {}),
        title: String(row.title || ""),
        nodeCount: Math.max(0, Number(row.node_count) || 0),
        connectionCount: Math.max(0, Number(row.connection_count) || 0),
        createdAt: isoDate(row.created_at),
        updatedAt: isoDate(row.updated_at),
    };
}

function jsonArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function isoDate(value: unknown) {
    const date = value instanceof Date ? value : new Date(String(value || ""));
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

export class CanvasProjectStoreError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}
