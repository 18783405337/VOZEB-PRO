export const POSTGRESQL_SMART_CLIP_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS smart_clip_configs (
    id text PRIMARY KEY,
    tenant_id text NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'mock',
    model text NOT NULL DEFAULT 'smart-clip',
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smart_clip_tasks (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clip_type text NOT NULL,
    scene text NOT NULL DEFAULT '',
    style_id text NOT NULL DEFAULT '',
    title text NOT NULL DEFAULT '',
    video_uri text NOT NULL DEFAULT '',
    audio_uri text NOT NULL DEFAULT '',
    materials_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    introduce_card_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    pack_rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    process_rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    struct_layers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    subtitle_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    language text NOT NULL DEFAULT '',
    source_app text NOT NULL DEFAULT '',
    source_result_id text NOT NULL DEFAULT '',
    channel text NOT NULL DEFAULT 'smart_clip',
    quality text NOT NULL DEFAULT '1',
    ratio text NOT NULL DEFAULT 'duration',
    duration_seconds integer NOT NULL DEFAULT 0,
    quantity integer NOT NULL DEFAULT 1,
    tenant_cost_points numeric(18, 2) NOT NULL DEFAULT 0,
    user_charge_points numeric(18, 2) NOT NULL DEFAULT 0,
    provider text NOT NULL DEFAULT 'mock',
    model text NOT NULL DEFAULT 'smart-clip',
    provider_task_id text NOT NULL DEFAULT '',
    provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    progress integer NOT NULL DEFAULT 0,
    error text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    deleted_at timestamptz,
    CONSTRAINT smart_clip_tasks_type CHECK (clip_type IN ('realman_broadcast', 'broadcast_mixcut', 'news_mixcut')),
    CONSTRAINT smart_clip_tasks_status CHECK (status IN ('pending', 'running', 'success', 'error', 'cancelled')),
    CONSTRAINT smart_clip_tasks_progress CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT smart_clip_tasks_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS smart_clip_tasks_owner_status_idx
    ON smart_clip_tasks (tenant_id, user_id, status, deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS smart_clip_tasks_provider_idx
    ON smart_clip_tasks (tenant_id, provider, provider_task_id)
    WHERE provider_task_id <> '';

CREATE TABLE IF NOT EXISTS smart_clip_results (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id text NOT NULL REFERENCES smart_clip_tasks(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clip_type text NOT NULL,
    style_id text NOT NULL DEFAULT '',
    title text NOT NULL DEFAULT '',
    cover_uri text NOT NULL DEFAULT '',
    video_uri text NOT NULL,
    storage_scope text NOT NULL DEFAULT 'tenant',
    duration_seconds integer NOT NULL DEFAULT 0,
    costs numeric(18, 2) NOT NULL DEFAULT 0,
    provider_task_id text NOT NULL DEFAULT '',
    result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT smart_clip_results_type CHECK (clip_type IN ('realman_broadcast', 'broadcast_mixcut', 'news_mixcut'))
);

CREATE INDEX IF NOT EXISTS smart_clip_results_owner_idx
    ON smart_clip_results (tenant_id, user_id, deleted_at, created_at DESC);

CREATE TABLE IF NOT EXISTS smart_clip_channels (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code text NOT NULL,
    name text NOT NULL,
    provider text NOT NULL DEFAULT 'mock',
    model text NOT NULL DEFAULT 'smart-clip',
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT smart_clip_channels_tenant_code_key UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS smart_clip_channel_specs (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel_code text NOT NULL,
    quality text NOT NULL DEFAULT '1',
    quality_label text NOT NULL DEFAULT 'standard',
    ratio text NOT NULL DEFAULT 'duration',
    width integer NOT NULL DEFAULT 0,
    height integer NOT NULL DEFAULT 0,
    unit_cost numeric(18, 2) NOT NULL DEFAULT 0,
    provider_params_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT smart_clip_channel_specs_key UNIQUE (tenant_id, channel_code, quality, ratio)
);

CREATE TABLE IF NOT EXISTS smart_clip_billings (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id text NOT NULL REFERENCES smart_clip_tasks(id) ON DELETE CASCADE,
    result_id text REFERENCES smart_clip_results(id) ON DELETE SET NULL,
    channel_code text NOT NULL DEFAULT 'smart_clip',
    quality text NOT NULL DEFAULT '1',
    ratio text NOT NULL DEFAULT 'duration',
    quantity integer NOT NULL DEFAULT 1,
    tenant_cost_points numeric(18, 2) NOT NULL DEFAULT 0,
    user_charge_points numeric(18, 2) NOT NULL DEFAULT 0,
    billing_status text NOT NULL DEFAULT 'pending',
    point_record_id text NOT NULL DEFAULT '',
    refund_record_id text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    refunded_at timestamptz,
    CONSTRAINT smart_clip_billings_status CHECK (billing_status IN ('pending', 'reserved', 'charged', 'refunded', 'failed')),
    CONSTRAINT smart_clip_billings_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS smart_clip_billings_task_idx
    ON smart_clip_billings (tenant_id, task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS smart_clip_sensitive_words (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    word text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT smart_clip_sensitive_words_tenant_word_key UNIQUE (tenant_id, word)
);

CREATE INDEX IF NOT EXISTS smart_clip_sensitive_words_tenant_idx
    ON smart_clip_sensitive_words (tenant_id, enabled, word);
`;
