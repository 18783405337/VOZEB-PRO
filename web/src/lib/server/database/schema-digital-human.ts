export const POSTGRESQL_DIGITAL_HUMAN_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS digital_human_configs (
    id text PRIMARY KEY,
    tenant_id text NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'mock',
    model text NOT NULL DEFAULT 'digital-human',
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_human_avatars (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id text REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    source text NOT NULL DEFAULT 'mine',
    gender text NOT NULL DEFAULT '',
    scene text NOT NULL DEFAULT '',
    cover_uri text NOT NULL DEFAULT '',
    media_uri text NOT NULL,
    media_type text NOT NULL DEFAULT 'image',
    storage_scope text NOT NULL DEFAULT 'tenant',
    provider text NOT NULL DEFAULT '',
    provider_asset_id text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'ready',
    sort_order integer NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT digital_human_avatars_source CHECK (source IN ('official', 'mine')),
    CONSTRAINT digital_human_avatars_status CHECK (status IN ('pending', 'ready', 'disabled', 'error'))
);

CREATE INDEX IF NOT EXISTS digital_human_avatars_owner_idx
    ON digital_human_avatars (tenant_id, user_id, source, deleted_at, sort_order, created_at DESC);

CREATE TABLE IF NOT EXISTS digital_human_voices (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id text REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    source text NOT NULL DEFAULT 'mine',
    gender text NOT NULL DEFAULT '',
    age_group text NOT NULL DEFAULT '',
    cover_uri text NOT NULL DEFAULT '',
    audio_uri text NOT NULL,
    preview_audio_uri text NOT NULL DEFAULT '',
    storage_scope text NOT NULL DEFAULT 'tenant',
    duration_seconds integer NOT NULL DEFAULT 0,
    provider text NOT NULL DEFAULT '',
    provider_asset_id text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'ready',
    sort_order integer NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT digital_human_voices_source CHECK (source IN ('official', 'mine')),
    CONSTRAINT digital_human_voices_status CHECK (status IN ('pending', 'ready', 'disabled', 'error'))
);

CREATE INDEX IF NOT EXISTS digital_human_voices_owner_idx
    ON digital_human_voices (tenant_id, user_id, source, deleted_at, sort_order, created_at DESC);

CREATE TABLE IF NOT EXISTS digital_human_tasks (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    avatar_id text REFERENCES digital_human_avatars(id) ON DELETE SET NULL,
    voice_id text REFERENCES digital_human_voices(id) ON DELETE SET NULL,
    title text NOT NULL DEFAULT '',
    script_text text NOT NULL DEFAULT '',
    prompt text NOT NULL DEFAULT '',
    mode text NOT NULL DEFAULT 'standard',
    ratio text NOT NULL DEFAULT '16:9',
    duration_seconds integer NOT NULL DEFAULT 0,
    provider text NOT NULL DEFAULT 'mock',
    model text NOT NULL DEFAULT 'digital-human',
    provider_task_id text NOT NULL DEFAULT '',
    provider_stage text NOT NULL DEFAULT '',
    provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    progress integer NOT NULL DEFAULT 0,
    error text NOT NULL DEFAULT '',
    result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    deleted_at timestamptz,
    CONSTRAINT digital_human_tasks_status CHECK (status IN ('pending', 'running', 'success', 'error', 'cancelled')),
    CONSTRAINT digital_human_tasks_progress CHECK (progress >= 0 AND progress <= 100)
);

CREATE INDEX IF NOT EXISTS digital_human_tasks_owner_status_idx
    ON digital_human_tasks (tenant_id, user_id, status, deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS digital_human_tasks_provider_idx
    ON digital_human_tasks (tenant_id, provider, provider_task_id)
    WHERE provider_task_id <> '';

CREATE TABLE IF NOT EXISTS digital_human_results (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id text NOT NULL REFERENCES digital_human_tasks(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    avatar_id text REFERENCES digital_human_avatars(id) ON DELETE SET NULL,
    voice_id text REFERENCES digital_human_voices(id) ON DELETE SET NULL,
    title text NOT NULL DEFAULT '',
    cover_uri text NOT NULL DEFAULT '',
    video_uri text NOT NULL,
    storage_scope text NOT NULL DEFAULT 'tenant',
    width integer NOT NULL DEFAULT 0,
    height integer NOT NULL DEFAULT 0,
    duration_seconds integer NOT NULL DEFAULT 0,
    provider_task_id text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS digital_human_results_owner_idx
    ON digital_human_results (tenant_id, user_id, deleted_at, created_at DESC);

CREATE TABLE IF NOT EXISTS digital_human_quotas (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_quota integer NOT NULL DEFAULT 0,
    used_quota integer NOT NULL DEFAULT 0,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id),
    CONSTRAINT digital_human_quotas_values CHECK (total_quota >= 0 AND used_quota >= 0 AND used_quota <= total_quota)
);

CREATE INDEX IF NOT EXISTS digital_human_quotas_tenant_idx
    ON digital_human_quotas (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS digital_human_sensitive_words (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    word text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, word)
);

CREATE INDEX IF NOT EXISTS digital_human_sensitive_words_tenant_idx
    ON digital_human_sensitive_words (tenant_id, enabled, word);
`;
