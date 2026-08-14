/**
 * Canvas Character Database Schema
 *
 * 角色资产管理和一致性检查相关表
 */

export const POSTGRESQL_CANVAS_CHARACTER_SCHEMA_SQL = `
-- 角色文档表
CREATE TABLE IF NOT EXISTS canvas_character_documents (
    id text PRIMARY KEY DEFAULT concat('char_', gen_random_uuid()::text),
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id text NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    character_id text NOT NULL,
    basic_info jsonb NOT NULL,
    appearance jsonb NOT NULL,
    personality jsonb,
    reference_images jsonb NOT NULL DEFAULT '[]'::jsonb,
    revision integer NOT NULL DEFAULT 1,
    last_consistency_check jsonb,
    version_drift jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canvas_character_documents_unique_character_id UNIQUE (user_id, project_id, character_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS canvas_character_documents_user_project_idx
    ON canvas_character_documents (user_id, project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS canvas_character_documents_character_type_idx
    ON canvas_character_documents USING gin ((basic_info->'characterType'));
CREATE INDEX IF NOT EXISTS canvas_character_documents_tags_idx
    ON canvas_character_documents USING gin ((basic_info->'tags'));
CREATE INDEX IF NOT EXISTS canvas_character_documents_name_search_idx
    ON canvas_character_documents USING gin ((basic_info->>'name') gin_trgm_ops);

-- 角色版本历史表
CREATE TABLE IF NOT EXISTS canvas_character_versions (
    id text PRIMARY KEY DEFAULT concat('charver_', gen_random_uuid()::text),
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id text NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    character_id text NOT NULL,
    revision integer NOT NULL,
    snapshot jsonb NOT NULL,
    description text,
    consistency_score numeric(5, 4),
    drift_from_base numeric(5, 4),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canvas_character_versions_unique_revision UNIQUE (user_id, project_id, character_id, revision)
);

-- 索引
CREATE INDEX IF NOT EXISTS canvas_character_versions_character_revision_idx
    ON canvas_character_versions (user_id, project_id, character_id, revision DESC);

-- 一致性检查历史表
CREATE TABLE IF NOT EXISTS canvas_character_consistency_checks (
    id text PRIMARY KEY DEFAULT concat('check_', gen_random_uuid()::text),
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id text NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    character_id text NOT NULL,
    check_id text NOT NULL,
    check_type text NOT NULL,
    consistency_score numeric(5, 4) NOT NULL,
    status text NOT NULL DEFAULT 'completed',
    details jsonb,
    base_image_id text,
    target_image_id text,
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canvas_character_consistency_checks_check_type CHECK (
        check_type IN ('visual_similarity', 'prompt_consistency', 'version_comparison', 'batch_consistency')
    ),
    CONSTRAINT canvas_character_consistency_checks_status CHECK (
        status IN ('pending', 'running', 'completed', 'failed')
    )
);

-- 索引
CREATE INDEX IF NOT EXISTS canvas_character_consistency_checks_character_idx
    ON canvas_character_consistency_checks (user_id, project_id, character_id, created_at DESC);
CREATE INDEX IF NOT EXISTS canvas_character_consistency_checks_check_id_idx
    ON canvas_character_consistency_checks (check_id);

-- 更新时间触发器
DROP TRIGGER IF EXISTS canvas_character_documents_set_updated_at ON canvas_character_documents;
CREATE TRIGGER canvas_character_documents_set_updated_at
    BEFORE UPDATE ON canvas_character_documents
    FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at();

-- 添加注释
COMMENT ON TABLE canvas_character_documents IS '角色资产文档表';
COMMENT ON TABLE canvas_character_versions IS '角色版本历史表';
COMMENT ON TABLE canvas_character_consistency_checks IS '角色一致性检查历史表';

COMMENT ON COLUMN canvas_character_documents.character_id IS '角色唯一标识符';
COMMENT ON COLUMN canvas_character_documents.basic_info IS '基础信息：名称、描述、类型、标签';
COMMENT ON COLUMN canvas_character_documents.appearance IS '外观描述：整体外观、发型、眼睛、体型、服装、特征';
COMMENT ON COLUMN canvas_character_documents.personality IS '性格特点：性格特质、说话方式、行为习惯、背景故事';
COMMENT ON COLUMN canvas_character_documents.reference_images IS '参考图片列表';
COMMENT ON COLUMN canvas_character_documents.revision IS '当前版本号';
COMMENT ON COLUMN canvas_character_documents.last_consistency_check IS '最后一次一致性检查结果';
COMMENT ON COLUMN canvas_character_documents.version_drift IS '版本漂移信息';

COMMENT ON COLUMN canvas_character_versions.snapshot IS '版本快照：包含 basicInfo, appearance, personality, referenceImages';
COMMENT ON COLUMN canvas_character_versions.consistency_score IS '该版本的一致性得分';
COMMENT ON COLUMN canvas_character_versions.drift_from_base IS '与基础版本的漂移程度';

COMMENT ON COLUMN canvas_character_consistency_checks.check_type IS '检查类型：visual_similarity, prompt_consistency, version_comparison, batch_consistency';
COMMENT ON COLUMN canvas_character_consistency_checks.consistency_score IS '一致性得分 (0-1)';
COMMENT ON COLUMN canvas_character_consistency_checks.details IS '检查详情：算法、距离、相似度、不一致特征';
`;
