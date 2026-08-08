export const POSTGRESQL_APPLICATION_CENTER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS apps (
    id text PRIMARY KEY,
    app_key text NOT NULL UNIQUE,
    name text NOT NULL,
    category text NOT NULL,
    status text NOT NULL CHECK (status IN ('draft', 'published', 'disabled')),
    current_version text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS app_versions (
    id text PRIMARY KEY,
    app_id text NOT NULL REFERENCES apps(id),
    version text NOT NULL,
    workflow_key text NOT NULL,
    renderer_key text NOT NULL,
    definition_json jsonb NOT NULL,
    published_at bigint,
    created_at bigint NOT NULL,
    UNIQUE (app_id, version)
);

CREATE INDEX IF NOT EXISTS app_versions_app_id_idx ON app_versions (app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_apps (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id),
    app_id text NOT NULL REFERENCES apps(id),
    selected_version_id text NOT NULL REFERENCES app_versions(id),
    status text NOT NULL CHECK (status IN ('enabled', 'disabled')),
    installed_by text NOT NULL REFERENCES users(id),
    installed_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    UNIQUE (tenant_id, app_id)
);

CREATE INDEX IF NOT EXISTS tenant_apps_tenant_status_idx ON tenant_apps (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS tenant_app_provider_bindings (
    id text PRIMARY KEY,
    tenant_app_id text NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
    logical_model_key text NOT NULL,
    status text NOT NULL CHECK (status IN ('enabled', 'disabled')),
    bound_by text NOT NULL REFERENCES users(id),
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    UNIQUE (tenant_app_id)
);

CREATE INDEX IF NOT EXISTS tenant_app_provider_bindings_logical_idx ON tenant_app_provider_bindings (logical_model_key, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS tenant_app_settings (
    id text PRIMARY KEY,
    tenant_app_id text NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
    settings_json jsonb NOT NULL,
    secret_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_by text NOT NULL REFERENCES users(id),
    updated_at bigint NOT NULL,
    UNIQUE (tenant_app_id)
);

CREATE TABLE IF NOT EXISTS tenant_app_pricing (
    id text PRIMARY KEY,
    tenant_app_id text NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
    currency text NOT NULL,
    sale_unit text NOT NULL,
    sale_amount bigint NOT NULL CHECK (sale_amount >= 0),
    collection_mode text NOT NULL CHECK (collection_mode IN ('platform', 'tenant')),
    updated_by text NOT NULL REFERENCES users(id),
    updated_at bigint NOT NULL,
    UNIQUE (tenant_app_id)
);
`;
