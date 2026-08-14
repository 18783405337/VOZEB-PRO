/**
 * Canvas Project Resources Database Schema
 *
 * 项目资源关联、Brief/Task/BrandKit节点增强、资源管理
 */

export const POSTGRESQL_CANVAS_RESOURCES_SCHEMA_SQL = `
-- 扩展 canvas_projects 表添加项目元数据
ALTER TABLE canvas_projects ADD COLUMN IF NOT EXISTS project_type text;
ALTER TABLE canvas_projects ADD COLUMN IF NOT EXISTS project_status text DEFAULT 'draft';
ALTER TABLE canvas_projects ADD COLUMN IF NOT EXISTS project_tags text[] DEFAULT ARRAY[]::text[];
ALTER TABLE canvas_projects ADD COLUMN IF NOT EXISTS project_metadata jsonb DEFAULT '{}'::jsonb;

-- 添加约束
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canvas_projects_type_check') THEN
        ALTER TABLE canvas_projects ADD CONSTRAINT canvas_projects_type_check
        CHECK (project_type IS NULL OR project_type IN ('short-drama', 'advertisement', 'brand', 'general'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canvas_projects_status_check') THEN
        ALTER TABLE canvas_projects ADD CONSTRAINT canvas_projects_status_check
        CHECK (project_status IN ('draft', 'in-progress', 'review', 'completed', 'archived'));
    END IF;
END;
$$;

-- 项目资源关联表（跟踪节点在项目中的角色）
CREATE TABLE IF NOT EXISTS canvas_project_resources (
    id text PRIMARY KEY DEFAULT concat('res_', gen_random_uuid()::text),
    project_id text NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    resource_type text NOT NULL,
    resource_role text,
    phase text,
    deliverable_ref text,
    sort_order integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canvas_project_resources_type_check CHECK (
        resource_type IN ('brief', 'task', 'brand-kit', 'image', 'video', 'text', 'audio', 'drawing', 'script', 'character', 'storyboard')
    ),
    CONSTRAINT canvas_project_resources_unique_node UNIQUE (project_id, node_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS canvas_project_resources_project_idx
    ON canvas_project_resources (project_id, resource_type, sort_order);
CREATE INDEX IF NOT EXISTS canvas_project_resources_user_idx
    ON canvas_project_resources (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS canvas_project_resources_phase_idx
    ON canvas_project_resources (project_id, phase) WHERE phase IS NOT NULL;
CREATE INDEX IF NOT EXISTS canvas_project_resources_role_idx
    ON canvas_project_resources (project_id, resource_role) WHERE resource_role IS NOT NULL;

-- 节点引用关系表（跟踪节点间的引用和依赖）
CREATE TABLE IF NOT EXISTS canvas_node_references (
    id text PRIMARY KEY DEFAULT concat('ref_', gen_random_uuid()::text),
    project_id text NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_node_id text NOT NULL,
    target_node_id text NOT NULL,
    reference_type text NOT NULL,
    reference_context text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canvas_node_references_type_check CHECK (
        reference_type IN ('uses', 'depends-on', 'references', 'derives-from', 'includes', 'outputs')
    ),
    CONSTRAINT canvas_node_references_unique UNIQUE (project_id, source_node_id, target_node_id, reference_type)
);

-- 索引
CREATE INDEX IF NOT EXISTS canvas_node_references_source_idx
    ON canvas_node_references (project_id, source_node_id, reference_type);
CREATE INDEX IF NOT EXISTS canvas_node_references_target_idx
    ON canvas_node_references (project_id, target_node_id, reference_type);
CREATE INDEX IF NOT EXISTS canvas_node_references_project_idx
    ON canvas_node_references (project_id, created_at DESC);

-- Brief 节点扩展数据表
CREATE TABLE IF NOT EXISTS canvas_brief_nodes (
    id text PRIMARY KEY DEFAULT concat('brief_', gen_random_uuid()::text),
    project_id text NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    objective text NOT NULL,
    audience text,
    usage text,
    core_message text,
    reference_strategy text,
    tone text[] DEFAULT ARRAY[]::text[],
    deliverables jsonb DEFAULT '[]'::jsonb,
    constraints text[] DEFAULT ARRAY[]::text[],
    referenced_node_ids text[] DEFAULT ARRAY[]::text[],
    version integer DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canvas_brief_nodes_unique_node UNIQUE (project_id, node_id)
);

CREATE INDEX IF NOT EXISTS canvas_brief_nodes_project_idx
    ON canvas_brief_nodes (project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS canvas_brief_nodes_search_idx
    ON canvas_brief_nodes USING gin (to_tsvector('simple', objective || ' ' || coalesce(audience, '') || ' ' || coalesce(core_message, '')));

-- Task 节点扩展数据表
CREATE TABLE IF NOT EXISTS canvas_task_nodes (
    id text PRIMARY KEY DEFAULT concat('task_', gen_random_uuid()::text),
    project_id text NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    task_type text NOT NULL,
    status text NOT NULL DEFAULT 'ready',
    agent_run_id text,
    agent_task_id text,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    dependencies text[] DEFAULT ARRAY[]::text[],
    output_node_ids text[] DEFAULT ARRAY[]::text[],
    error_message text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canvas_task_nodes_type_check CHECK (
        task_type IN ('text', 'image', 'video', 'audio', 'generation')
    ),
    CONSTRAINT canvas_task_nodes_status_check CHECK (
        status IN ('ready', 'pending', 'running', 'paused', 'waiting_user', 'completed', 'failed', 'cancelled')
    ),
    CONSTRAINT canvas_task_nodes_unique_node UNIQUE (project_id, node_id)
);

CREATE INDEX IF NOT EXISTS canvas_task_nodes_project_status_idx
    ON canvas_task_nodes (project_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS canvas_task_nodes_agent_idx
    ON canvas_task_nodes (agent_run_id) WHERE agent_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS canvas_task_nodes_dependencies_idx
    ON canvas_task_nodes USING gin (dependencies);

-- BrandKit 节点扩展数据表
CREATE TABLE IF NOT EXISTS canvas_brandkit_nodes (
    id text PRIMARY KEY DEFAULT concat('brand_', gen_random_uuid()::text),
    project_id text NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id text NOT NULL,
    summary text,
    style text,
    composition text,
    colors text[] DEFAULT ARRAY[]::text[],
    lighting text,
    keywords text[] DEFAULT ARRAY[]::text[],
    visual_keywords text[] DEFAULT ARRAY[]::text[],
    avoid text[] DEFAULT ARRAY[]::text[],
    typography text[] DEFAULT ARRAY[]::text[],
    approved_node_ids text[] DEFAULT ARRAY[]::text[],
    rejected_node_ids text[] DEFAULT ARRAY[]::text[],
    version integer DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canvas_brandkit_nodes_unique_node UNIQUE (project_id, node_id)
);

CREATE INDEX IF NOT EXISTS canvas_brandkit_nodes_project_idx
    ON canvas_brandkit_nodes (project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS canvas_brandkit_nodes_keywords_idx
    ON canvas_brandkit_nodes USING gin (keywords);
CREATE INDEX IF NOT EXISTS canvas_brandkit_nodes_approved_idx
    ON canvas_brandkit_nodes USING gin (approved_node_ids);

-- 更新时间触发器
DROP TRIGGER IF EXISTS canvas_project_resources_set_updated_at ON canvas_project_resources;
CREATE TRIGGER canvas_project_resources_set_updated_at
    BEFORE UPDATE ON canvas_project_resources
    FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at();

DROP TRIGGER IF EXISTS canvas_brief_nodes_set_updated_at ON canvas_brief_nodes;
CREATE TRIGGER canvas_brief_nodes_set_updated_at
    BEFORE UPDATE ON canvas_brief_nodes
    FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at();

DROP TRIGGER IF EXISTS canvas_task_nodes_set_updated_at ON canvas_task_nodes;
CREATE TRIGGER canvas_task_nodes_set_updated_at
    BEFORE UPDATE ON canvas_task_nodes
    FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at();

DROP TRIGGER IF EXISTS canvas_brandkit_nodes_set_updated_at ON canvas_brandkit_nodes;
CREATE TRIGGER canvas_brandkit_nodes_set_updated_at
    BEFORE UPDATE ON canvas_brandkit_nodes
    FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at();

-- 添加注释
COMMENT ON TABLE canvas_project_resources IS '项目资源关联表';
COMMENT ON TABLE canvas_node_references IS '节点引用关系表';
COMMENT ON TABLE canvas_brief_nodes IS 'Brief 节点扩展数据';
COMMENT ON TABLE canvas_task_nodes IS 'Task 节点扩展数据';
COMMENT ON TABLE canvas_brandkit_nodes IS 'BrandKit 节点扩展数据';

COMMENT ON COLUMN canvas_projects.project_type IS '项目类型：短剧/广告/品牌/通用';
COMMENT ON COLUMN canvas_projects.project_status IS '项目状态：草稿/进行中/审核/完成/归档';
COMMENT ON COLUMN canvas_projects.project_tags IS '项目标签';
COMMENT ON COLUMN canvas_projects.project_metadata IS '项目元数据（预算、团队、截止日期等）';

COMMENT ON COLUMN canvas_project_resources.resource_role IS '资源角色（primary-brief, reference, output等）';
COMMENT ON COLUMN canvas_project_resources.phase IS '项目阶段（planning, production, review等）';
COMMENT ON COLUMN canvas_project_resources.deliverable_ref IS '关联的交付物引用';

COMMENT ON COLUMN canvas_node_references.reference_type IS '引用类型：uses, depends-on, references, derives-from, includes, outputs';
COMMENT ON COLUMN canvas_node_references.reference_context IS '引用上下文描述';
`;
