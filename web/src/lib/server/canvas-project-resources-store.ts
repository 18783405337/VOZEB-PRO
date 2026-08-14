/**
 * Canvas Project Resources Store
 *
 * 项目资源关联、Brief/Task/BrandKit 节点数据存储
 */

import type {
    CanvasBriefNode,
    CanvasBrandKitNode,
    CanvasNodeReference,
    CanvasProjectResource,
    CanvasProjectResourceSummary,
    CanvasTaskNode,
    CreateCanvasBriefInput,
    CreateCanvasBrandKitInput,
    CreateCanvasNodeReferenceInput,
    CreateCanvasResourceInput,
    CreateCanvasTaskInput,
    UpdateCanvasBriefInput,
    UpdateCanvasBrandKitInput,
    UpdateCanvasTaskInput,
    CanvasNodeDependencyGraph,
    CanvasProjectSearchOptions,
    CanvasProjectSearchResult,
} from "@/lib/canvas-project-resources-contract";
import { getDatabaseProvider, postgresQuery, ensurePostgresSchema } from "@/lib/server/database";

// ==================== Project Resources ====================

export async function createProjectResource(projectId: string, userId: string, input: CreateCanvasResourceInput): Promise<CanvasProjectResource> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Project resources only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery<Record<string, unknown>>(
        `INSERT INTO canvas_project_resources
            (project_id, user_id, node_id, resource_type, resource_role, phase, deliverable_ref, sort_order, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING *`,
        [
            projectId,
            userId,
            input.nodeId,
            input.resourceType,
            input.resourceRole || null,
            input.phase || null,
            input.deliverableRef || null,
            input.sortOrder || 0,
            JSON.stringify(input.metadata || {}),
        ],
    );

    if (!result.rows[0]) throw new Error("Failed to create project resource");
    return mapProjectResource(result.rows[0]);
}

export async function listProjectResources(projectId: string, userId: string, resourceType?: string): Promise<CanvasProjectResource[]> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Project resources only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const query = resourceType
        ? `SELECT * FROM canvas_project_resources WHERE project_id = $1 AND user_id = $2 AND resource_type = $3 ORDER BY sort_order, created_at`
        : `SELECT * FROM canvas_project_resources WHERE project_id = $1 AND user_id = $2 ORDER BY resource_type, sort_order, created_at`;

    const params = resourceType ? [projectId, userId, resourceType] : [projectId, userId];
    const result = await postgresQuery<Record<string, unknown>>(query, params);

    return result.rows.map(mapProjectResource);
}

export async function deleteProjectResource(projectId: string, userId: string, nodeId: string): Promise<boolean> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Project resources only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery(
        `DELETE FROM canvas_project_resources WHERE project_id = $1 AND user_id = $2 AND node_id = $3 RETURNING id`,
        [projectId, userId, nodeId],
    );

    return result.rowCount > 0;
}

export async function getProjectResourceSummary(projectId: string, userId: string): Promise<CanvasProjectResourceSummary> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Project resources only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery<Record<string, unknown>>(
        `SELECT
            COUNT(*)::int AS total_resources,
            COUNT(*) FILTER (WHERE resource_type = 'brief')::int AS brief_count,
            COUNT(*) FILTER (WHERE resource_type = 'task')::int AS task_count,
            COUNT(*) FILTER (WHERE resource_type = 'brand-kit')::int AS brand_kit_count,
            COUNT(*) FILTER (WHERE resource_type = 'image')::int AS image_count,
            COUNT(*) FILTER (WHERE resource_type = 'video')::int AS video_count
         FROM canvas_project_resources
         WHERE project_id = $1 AND user_id = $2`,
        [projectId, userId],
    );

    const taskResult = await postgresQuery<Record<string, unknown>>(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_tasks,
            COUNT(*) FILTER (WHERE status IN ('ready', 'pending', 'running'))::int AS pending_tasks,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_tasks
         FROM canvas_task_nodes
         WHERE project_id = $1 AND user_id = $2`,
        [projectId, userId],
    );

    const recentResult = await postgresQuery<Record<string, unknown>>(
        `SELECT node_id, resource_type, metadata->>'title' AS title, updated_at
         FROM canvas_project_resources
         WHERE project_id = $1 AND user_id = $2
         ORDER BY updated_at DESC
         LIMIT 10`,
        [projectId, userId],
    );

    const row = result.rows[0] || {};
    const taskRow = taskResult.rows[0] || {};

    return {
        projectId,
        totalResources: Number(row.total_resources) || 0,
        briefCount: Number(row.brief_count) || 0,
        taskCount: Number(row.task_count) || 0,
        brandKitCount: Number(row.brand_kit_count) || 0,
        imageCount: Number(row.image_count) || 0,
        videoCount: Number(row.video_count) || 0,
        completedTasks: Number(taskRow.completed_tasks) || 0,
        pendingTasks: Number(taskRow.pending_tasks) || 0,
        failedTasks: Number(taskRow.failed_tasks) || 0,
        recentResources: recentResult.rows.map((r) => ({
            nodeId: String(r.node_id || ""),
            resourceType: String(r.resource_type || "") as any,
            title: r.title ? String(r.title) : undefined,
            updatedAt: isoDate(r.updated_at),
        })),
    };
}

// ==================== Node References ====================

export async function createNodeReference(projectId: string, userId: string, input: CreateCanvasNodeReferenceInput): Promise<CanvasNodeReference> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Node references only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery<Record<string, unknown>>(
        `INSERT INTO canvas_node_references
            (project_id, user_id, source_node_id, target_node_id, reference_type, reference_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (project_id, source_node_id, target_node_id, reference_type)
         DO UPDATE SET reference_context = EXCLUDED.reference_context, metadata = EXCLUDED.metadata
         RETURNING *`,
        [
            projectId,
            userId,
            input.sourceNodeId,
            input.targetNodeId,
            input.referenceType,
            input.referenceContext || null,
            JSON.stringify(input.metadata || {}),
        ],
    );

    if (!result.rows[0]) throw new Error("Failed to create node reference");
    return mapNodeReference(result.rows[0]);
}

export async function listNodeReferences(projectId: string, nodeId: string, direction: "outgoing" | "incoming" | "both" = "both"): Promise<CanvasNodeReference[]> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Node references only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    let query = "";
    if (direction === "outgoing") {
        query = `SELECT * FROM canvas_node_references WHERE project_id = $1 AND source_node_id = $2 ORDER BY created_at`;
    } else if (direction === "incoming") {
        query = `SELECT * FROM canvas_node_references WHERE project_id = $1 AND target_node_id = $2 ORDER BY created_at`;
    } else {
        query = `SELECT * FROM canvas_node_references WHERE project_id = $1 AND (source_node_id = $2 OR target_node_id = $2) ORDER BY created_at`;
    }

    const result = await postgresQuery<Record<string, unknown>>(query, [projectId, nodeId]);
    return result.rows.map(mapNodeReference);
}

export async function getNodeDependencyGraph(projectId: string, nodeId: string): Promise<CanvasNodeDependencyGraph> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Node references only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const references = await listNodeReferences(projectId, nodeId, "both");

    const dependencies: string[] = [];
    const dependents: string[] = [];
    const referencesOut: Array<{ targetNodeId: string; referenceType: any }> = [];
    const referencesIn: Array<{ sourceNodeId: string; referenceType: any }> = [];

    for (const ref of references) {
        if (ref.sourceNodeId === nodeId) {
            referencesOut.push({ targetNodeId: ref.targetNodeId, referenceType: ref.referenceType });
            if (ref.referenceType === "depends-on") {
                dependencies.push(ref.targetNodeId);
            }
        }
        if (ref.targetNodeId === nodeId) {
            referencesIn.push({ sourceNodeId: ref.sourceNodeId, referenceType: ref.referenceType });
            if (ref.referenceType === "depends-on") {
                dependents.push(ref.sourceNodeId);
            }
        }
    }

    return {
        nodeId,
        dependencies,
        dependents,
        references: referencesOut,
        referencedBy: referencesIn,
    };
}

export async function deleteNodeReference(projectId: string, sourceNodeId: string, targetNodeId: string, referenceType: string): Promise<boolean> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Node references only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery(
        `DELETE FROM canvas_node_references WHERE project_id = $1 AND source_node_id = $2 AND target_node_id = $3 AND reference_type = $4 RETURNING id`,
        [projectId, sourceNodeId, targetNodeId, referenceType],
    );

    return result.rowCount > 0;
}

// ==================== Brief Nodes ====================

export async function createBriefNode(projectId: string, userId: string, input: CreateCanvasBriefInput): Promise<CanvasBriefNode> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Brief nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery<Record<string, unknown>>(
        `INSERT INTO canvas_brief_nodes
            (project_id, user_id, node_id, objective, audience, usage, core_message, reference_strategy, tone, deliverables, constraints, referenced_node_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
         RETURNING *`,
        [
            projectId,
            userId,
            input.nodeId,
            input.objective,
            input.audience || null,
            input.usage || null,
            input.coreMessage || null,
            input.referenceStrategy || null,
            input.tone || [],
            JSON.stringify(input.deliverables || []),
            input.constraints || [],
            input.referencedNodeIds || [],
        ],
    );

    if (!result.rows[0]) throw new Error("Failed to create brief node");
    return mapBriefNode(result.rows[0]);
}

export async function getBriefNode(projectId: string, nodeId: string): Promise<CanvasBriefNode | null> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Brief nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery<Record<string, unknown>>(`SELECT * FROM canvas_brief_nodes WHERE project_id = $1 AND node_id = $2`, [projectId, nodeId]);

    return result.rows[0] ? mapBriefNode(result.rows[0]) : null;
}

export async function updateBriefNode(projectId: string, nodeId: string, input: UpdateCanvasBriefInput): Promise<CanvasBriefNode> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Brief nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const updates: string[] = [];
    const values: unknown[] = [projectId, nodeId];
    let paramIndex = 3;

    if (input.objective !== undefined) {
        updates.push(`objective = $${paramIndex++}`);
        values.push(input.objective);
    }
    if (input.audience !== undefined) {
        updates.push(`audience = $${paramIndex++}`);
        values.push(input.audience);
    }
    if (input.usage !== undefined) {
        updates.push(`usage = $${paramIndex++}`);
        values.push(input.usage);
    }
    if (input.coreMessage !== undefined) {
        updates.push(`core_message = $${paramIndex++}`);
        values.push(input.coreMessage);
    }
    if (input.referenceStrategy !== undefined) {
        updates.push(`reference_strategy = $${paramIndex++}`);
        values.push(input.referenceStrategy);
    }
    if (input.tone !== undefined) {
        updates.push(`tone = $${paramIndex++}`);
        values.push(input.tone);
    }
    if (input.deliverables !== undefined) {
        updates.push(`deliverables = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(input.deliverables));
    }
    if (input.constraints !== undefined) {
        updates.push(`constraints = $${paramIndex++}`);
        values.push(input.constraints);
    }
    if (input.referencedNodeIds !== undefined) {
        updates.push(`referenced_node_ids = $${paramIndex++}`);
        values.push(input.referencedNodeIds);
    }

    if (updates.length === 0) {
        const existing = await getBriefNode(projectId, nodeId);
        if (!existing) throw new Error("Brief node not found");
        return existing;
    }

    updates.push(`version = version + 1`);

    const result = await postgresQuery<Record<string, unknown>>(
        `UPDATE canvas_brief_nodes SET ${updates.join(", ")} WHERE project_id = $1 AND node_id = $2 RETURNING *`,
        values,
    );

    if (!result.rows[0]) throw new Error("Brief node not found");
    return mapBriefNode(result.rows[0]);
}

export async function deleteBriefNode(projectId: string, nodeId: string): Promise<boolean> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Brief nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery(`DELETE FROM canvas_brief_nodes WHERE project_id = $1 AND node_id = $2 RETURNING id`, [projectId, nodeId]);

    return result.rowCount > 0;
}

// ==================== Task Nodes ====================

export async function createTaskNode(projectId: string, userId: string, input: CreateCanvasTaskInput): Promise<CanvasTaskNode> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Task nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery<Record<string, unknown>>(
        `INSERT INTO canvas_task_nodes
            (project_id, user_id, node_id, task_type, status, dependencies, max_attempts)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [projectId, userId, input.nodeId, input.taskType, input.status || "ready", input.dependencies || [], input.maxAttempts || 3],
    );

    if (!result.rows[0]) throw new Error("Failed to create task node");
    return mapTaskNode(result.rows[0]);
}

export async function getTaskNode(projectId: string, nodeId: string): Promise<CanvasTaskNode | null> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Task nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery<Record<string, unknown>>(`SELECT * FROM canvas_task_nodes WHERE project_id = $1 AND node_id = $2`, [projectId, nodeId]);

    return result.rows[0] ? mapTaskNode(result.rows[0]) : null;
}

export async function updateTaskNode(projectId: string, nodeId: string, input: UpdateCanvasTaskInput): Promise<CanvasTaskNode> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Task nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const updates: string[] = [];
    const values: unknown[] = [projectId, nodeId];
    let paramIndex = 3;

    if (input.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(input.status);
    }
    if (input.agentRunId !== undefined) {
        updates.push(`agent_run_id = $${paramIndex++}`);
        values.push(input.agentRunId);
    }
    if (input.agentTaskId !== undefined) {
        updates.push(`agent_task_id = $${paramIndex++}`);
        values.push(input.agentTaskId);
    }
    if (input.dependencies !== undefined) {
        updates.push(`dependencies = $${paramIndex++}`);
        values.push(input.dependencies);
    }
    if (input.errorMessage !== undefined) {
        updates.push(`error_message = $${paramIndex++}`);
        values.push(input.errorMessage);
    }
    if (input.startedAt !== undefined) {
        updates.push(`started_at = $${paramIndex++}`);
        values.push(input.startedAt ? new Date(input.startedAt) : null);
    }
    if (input.completedAt !== undefined) {
        updates.push(`completed_at = $${paramIndex++}`);
        values.push(input.completedAt ? new Date(input.completedAt) : null);
    }

    if (input.status === "running") {
        updates.push(`attempts = attempts + 1`);
    }

    if (updates.length === 0) {
        const existing = await getTaskNode(projectId, nodeId);
        if (!existing) throw new Error("Task node not found");
        return existing;
    }

    const result = await postgresQuery<Record<string, unknown>>(
        `UPDATE canvas_task_nodes SET ${updates.join(", ")} WHERE project_id = $1 AND node_id = $2 RETURNING *`,
        values,
    );

    if (!result.rows[0]) throw new Error("Task node not found");
    return mapTaskNode(result.rows[0]);
}

export async function listTaskNodes(projectId: string, userId: string, status?: string): Promise<CanvasTaskNode[]> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Task nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const query = status
        ? `SELECT * FROM canvas_task_nodes WHERE project_id = $1 AND user_id = $2 AND status = $3 ORDER BY updated_at DESC`
        : `SELECT * FROM canvas_task_nodes WHERE project_id = $1 AND user_id = $2 ORDER BY updated_at DESC`;

    const params = status ? [projectId, userId, status] : [projectId, userId];
    const result = await postgresQuery<Record<string, unknown>>(query, params);

    return result.rows.map(mapTaskNode);
}

export async function deleteTaskNode(projectId: string, nodeId: string): Promise<boolean> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Task nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery(`DELETE FROM canvas_task_nodes WHERE project_id = $1 AND node_id = $2 RETURNING id`, [projectId, nodeId]);

    return result.rowCount > 0;
}

// ==================== BrandKit Nodes ====================

export async function createBrandKitNode(projectId: string, userId: string, input: CreateCanvasBrandKitInput): Promise<CanvasBrandKitNode> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("BrandKit nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery<Record<string, unknown>>(
        `INSERT INTO canvas_brandkit_nodes
            (project_id, user_id, node_id, summary, style, composition, colors, lighting, keywords, visual_keywords, avoid, typography, approved_node_ids, rejected_node_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
            projectId,
            userId,
            input.nodeId,
            input.summary || null,
            input.style || null,
            input.composition || null,
            input.colors || [],
            input.lighting || null,
            input.keywords || [],
            input.visualKeywords || [],
            input.avoid || [],
            input.typography || [],
            input.approvedNodeIds || [],
            input.rejectedNodeIds || [],
        ],
    );

    if (!result.rows[0]) throw new Error("Failed to create brandkit node");
    return mapBrandKitNode(result.rows[0]);
}

export async function getBrandKitNode(projectId: string, nodeId: string): Promise<CanvasBrandKitNode | null> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("BrandKit nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery<Record<string, unknown>>(`SELECT * FROM canvas_brandkit_nodes WHERE project_id = $1 AND node_id = $2`, [projectId, nodeId]);

    return result.rows[0] ? mapBrandKitNode(result.rows[0]) : null;
}

export async function updateBrandKitNode(projectId: string, nodeId: string, input: UpdateCanvasBrandKitInput): Promise<CanvasBrandKitNode> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("BrandKit nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const updates: string[] = [];
    const values: unknown[] = [projectId, nodeId];
    let paramIndex = 3;

    if (input.summary !== undefined) {
        updates.push(`summary = $${paramIndex++}`);
        values.push(input.summary);
    }
    if (input.style !== undefined) {
        updates.push(`style = $${paramIndex++}`);
        values.push(input.style);
    }
    if (input.composition !== undefined) {
        updates.push(`composition = $${paramIndex++}`);
        values.push(input.composition);
    }
    if (input.colors !== undefined) {
        updates.push(`colors = $${paramIndex++}`);
        values.push(input.colors);
    }
    if (input.lighting !== undefined) {
        updates.push(`lighting = $${paramIndex++}`);
        values.push(input.lighting);
    }
    if (input.keywords !== undefined) {
        updates.push(`keywords = $${paramIndex++}`);
        values.push(input.keywords);
    }
    if (input.visualKeywords !== undefined) {
        updates.push(`visual_keywords = $${paramIndex++}`);
        values.push(input.visualKeywords);
    }
    if (input.avoid !== undefined) {
        updates.push(`avoid = $${paramIndex++}`);
        values.push(input.avoid);
    }
    if (input.typography !== undefined) {
        updates.push(`typography = $${paramIndex++}`);
        values.push(input.typography);
    }
    if (input.approvedNodeIds !== undefined) {
        updates.push(`approved_node_ids = $${paramIndex++}`);
        values.push(input.approvedNodeIds);
    }
    if (input.rejectedNodeIds !== undefined) {
        updates.push(`rejected_node_ids = $${paramIndex++}`);
        values.push(input.rejectedNodeIds);
    }

    if (updates.length === 0) {
        const existing = await getBrandKitNode(projectId, nodeId);
        if (!existing) throw new Error("BrandKit node not found");
        return existing;
    }

    updates.push(`version = version + 1`);

    const result = await postgresQuery<Record<string, unknown>>(
        `UPDATE canvas_brandkit_nodes SET ${updates.join(", ")} WHERE project_id = $1 AND node_id = $2 RETURNING *`,
        values,
    );

    if (!result.rows[0]) throw new Error("BrandKit node not found");
    return mapBrandKitNode(result.rows[0]);
}

export async function deleteBrandKitNode(projectId: string, nodeId: string): Promise<boolean> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("BrandKit nodes only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const result = await postgresQuery(`DELETE FROM canvas_brandkit_nodes WHERE project_id = $1 AND node_id = $2 RETURNING id`, [projectId, nodeId]);

    return result.rowCount > 0;
}

// ==================== Project Search ====================

export async function searchProjects(userId: string, options: CanvasProjectSearchOptions): Promise<CanvasProjectSearchResult[]> {
    if (getDatabaseProvider() !== "postgres") {
        throw new Error("Project search only supported with PostgreSQL");
    }
    await ensurePostgresSchema();

    const conditions: string[] = ["cp.user_id = $1"];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (options.projectType) {
        conditions.push(`cp.project_type = $${paramIndex++}`);
        params.push(options.projectType);
    }

    if (options.projectStatus) {
        conditions.push(`cp.project_status = $${paramIndex++}`);
        params.push(options.projectStatus);
    }

    if (options.tags && options.tags.length > 0) {
        conditions.push(`cp.project_tags && $${paramIndex++}::text[]`);
        params.push(options.tags);
    }

    if (options.resourceType) {
        conditions.push(`EXISTS (SELECT 1 FROM canvas_project_resources WHERE project_id = cp.id AND resource_type = $${paramIndex++})`);
        params.push(options.resourceType);
    }

    if (options.query) {
        conditions.push(`(cp.title ILIKE $${paramIndex} OR EXISTS (SELECT 1 FROM canvas_project_resources r WHERE r.project_id = cp.id AND r.metadata->>'title' ILIKE $${paramIndex}))`);
        params.push(`%${options.query}%`);
        paramIndex++;
    }

    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const result = await postgresQuery<Record<string, unknown>>(
        `SELECT
            cp.id, cp.title, cp.project_type, cp.project_status, cp.project_tags, cp.updated_at,
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'nodeId', r.node_id,
                    'resourceType', r.resource_type,
                    'title', r.metadata->>'title'
                ))
                FROM canvas_project_resources r
                WHERE r.project_id = cp.id
                ORDER BY r.updated_at DESC
                LIMIT 5),
                '[]'::jsonb
            ) AS matched_resources
         FROM canvas_projects cp
         WHERE ${conditions.join(" AND ")}
         ORDER BY cp.updated_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset],
    );

    return result.rows.map((row) => ({
        projectId: String(row.id || ""),
        title: String(row.title || ""),
        projectType: row.project_type ? String(row.project_type) as any : undefined,
        projectStatus: String(row.project_status || "draft") as any,
        tags: Array.isArray(row.project_tags) ? row.project_tags.map(String) : [],
        matchedResources: parseJsonArray(row.matched_resources),
        updatedAt: isoDate(row.updated_at),
    }));
}

// ==================== Mappers ====================

function mapProjectResource(row: Record<string, unknown>): CanvasProjectResource {
    return {
        id: String(row.id || ""),
        projectId: String(row.project_id || ""),
        userId: String(row.user_id || ""),
        nodeId: String(row.node_id || ""),
        resourceType: String(row.resource_type || "") as any,
        resourceRole: row.resource_role ? String(row.resource_role) : undefined,
        phase: row.phase ? String(row.phase) : undefined,
        deliverableRef: row.deliverable_ref ? String(row.deliverable_ref) : undefined,
        sortOrder: Number(row.sort_order) || 0,
        metadata: parseJson(row.metadata),
        createdAt: isoDate(row.created_at),
        updatedAt: isoDate(row.updated_at),
    };
}

function mapNodeReference(row: Record<string, unknown>): CanvasNodeReference {
    return {
        id: String(row.id || ""),
        projectId: String(row.project_id || ""),
        userId: String(row.user_id || ""),
        sourceNodeId: String(row.source_node_id || ""),
        targetNodeId: String(row.target_node_id || ""),
        referenceType: String(row.reference_type || "") as any,
        referenceContext: row.reference_context ? String(row.reference_context) : undefined,
        metadata: parseJson(row.metadata),
        createdAt: isoDate(row.created_at),
    };
}

function mapBriefNode(row: Record<string, unknown>): CanvasBriefNode {
    return {
        id: String(row.id || ""),
        projectId: String(row.project_id || ""),
        userId: String(row.user_id || ""),
        nodeId: String(row.node_id || ""),
        objective: String(row.objective || ""),
        audience: row.audience ? String(row.audience) : undefined,
        usage: row.usage ? String(row.usage) : undefined,
        coreMessage: row.core_message ? String(row.core_message) : undefined,
        referenceStrategy: row.reference_strategy ? String(row.reference_strategy) : undefined,
        tone: parseStringArray(row.tone),
        deliverables: parseJsonArray(row.deliverables),
        constraints: parseStringArray(row.constraints),
        referencedNodeIds: parseStringArray(row.referenced_node_ids),
        version: Number(row.version) || 1,
        createdAt: isoDate(row.created_at),
        updatedAt: isoDate(row.updated_at),
    };
}

function mapTaskNode(row: Record<string, unknown>): CanvasTaskNode {
    return {
        id: String(row.id || ""),
        projectId: String(row.project_id || ""),
        userId: String(row.user_id || ""),
        nodeId: String(row.node_id || ""),
        taskType: String(row.task_type || "") as any,
        status: String(row.status || "ready") as any,
        agentRunId: row.agent_run_id ? String(row.agent_run_id) : undefined,
        agentTaskId: row.agent_task_id ? String(row.agent_task_id) : undefined,
        attempts: Number(row.attempts) || 0,
        maxAttempts: Number(row.max_attempts) || 3,
        dependencies: parseStringArray(row.dependencies),
        outputNodeIds: parseStringArray(row.output_node_ids),
        errorMessage: row.error_message ? String(row.error_message) : undefined,
        startedAt: row.started_at ? isoDate(row.started_at) : undefined,
        completedAt: row.completed_at ? isoDate(row.completed_at) : undefined,
        createdAt: isoDate(row.created_at),
        updatedAt: isoDate(row.updated_at),
    };
}

function mapBrandKitNode(row: Record<string, unknown>): CanvasBrandKitNode {
    return {
        id: String(row.id || ""),
        projectId: String(row.project_id || ""),
        userId: String(row.user_id || ""),
        nodeId: String(row.node_id || ""),
        summary: row.summary ? String(row.summary) : undefined,
        style: row.style ? String(row.style) : undefined,
        composition: row.composition ? String(row.composition) : undefined,
        colors: parseStringArray(row.colors),
        lighting: row.lighting ? String(row.lighting) : undefined,
        keywords: parseStringArray(row.keywords),
        visualKeywords: parseStringArray(row.visual_keywords),
        avoid: parseStringArray(row.avoid),
        typography: parseStringArray(row.typography),
        approvedNodeIds: parseStringArray(row.approved_node_ids),
        rejectedNodeIds: parseStringArray(row.rejected_node_ids),
        version: Number(row.version) || 1,
        createdAt: isoDate(row.created_at),
        updatedAt: isoDate(row.updated_at),
    };
}

// ==================== Helpers ====================

function isoDate(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value || ""));
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function parseJson(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value !== "string") return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function parseJsonArray(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function parseStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    return [];
}
