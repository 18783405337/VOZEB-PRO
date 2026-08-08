export const POSTGRESQL_IMAGE_HUMAN_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS image_human_configs (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'mock',
    model text NOT NULL DEFAULT 'image-human',
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS image_human_tasks (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT '',
    source_image_uri text NOT NULL,
    reference_audio_uri text NOT NULL,
    script_text text NOT NULL DEFAULT '',
    prompt text NOT NULL DEFAULT '',
    mode text NOT NULL DEFAULT 'standard',
    duration_seconds integer NOT NULL DEFAULT 0,
    provider text NOT NULL DEFAULT 'mock',
    model text NOT NULL DEFAULT 'image-human',
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
    CONSTRAINT image_human_tasks_status CHECK (status IN ('pending', 'running', 'success', 'error', 'cancelled')),
    CONSTRAINT image_human_tasks_progress CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT image_human_tasks_duration CHECK (duration_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS image_human_tasks_owner_status_idx
    ON image_human_tasks (tenant_id, user_id, status, deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS image_human_tasks_provider_idx
    ON image_human_tasks (tenant_id, provider, provider_task_id)
    WHERE provider_task_id <> '';

CREATE TABLE IF NOT EXISTS image_human_results (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id text NOT NULL UNIQUE REFERENCES image_human_tasks(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS image_human_results_owner_idx
    ON image_human_results (tenant_id, user_id, deleted_at, created_at DESC);
`;
