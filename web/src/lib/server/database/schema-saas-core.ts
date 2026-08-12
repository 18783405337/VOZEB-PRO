export const POSTGRESQL_SAAS_CORE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tenants (
    id text PRIMARY KEY,
    slug text NOT NULL,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenants_status CHECK (status IN ('active', 'disabled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_lower_idx ON tenants (lower(slug));

INSERT INTO tenants (id, slug, name, status)
VALUES ('default', 'default', '默认租户', 'active')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_domains (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    hostname text NOT NULL,
    kind text NOT NULL DEFAULT 'custom',
    status text NOT NULL DEFAULT 'pending',
    verification_token text NOT NULL DEFAULT '',
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenant_domains_kind CHECK (kind IN ('custom', 'subdomain')),
    CONSTRAINT tenant_domains_status CHECK (status IN ('pending', 'verified', 'disabled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_hostname_lower_idx ON tenant_domains (lower(hostname));

CREATE TABLE IF NOT EXISTS tenant_roles (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key text NOT NULL,
    name text NOT NULL,
    system boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenant_roles_tenant_id_id_key UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS tenant_role_permissions (
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id text NOT NULL,
    permission text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, role_id, permission),
    CONSTRAINT tenant_role_permissions_tenant_role_fkey
        FOREIGN KEY (tenant_id, role_id)
        REFERENCES tenant_roles(tenant_id, id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_members (
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    joined_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id),
    CONSTRAINT tenant_members_status CHECK (status IN ('active', 'disabled')),
    CONSTRAINT tenant_members_tenant_role_fkey
        FOREIGN KEY (tenant_id, role_id)
        REFERENCES tenant_roles(tenant_id, id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tenant_roles_tenant_id_id_key'
          AND conrelid = 'tenant_roles'::regclass
    ) THEN
        ALTER TABLE tenant_roles
            ADD CONSTRAINT tenant_roles_tenant_id_id_key UNIQUE (tenant_id, id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tenant_role_permissions_tenant_role_fkey'
          AND conrelid = 'tenant_role_permissions'::regclass
    ) THEN
        ALTER TABLE tenant_role_permissions
            ADD CONSTRAINT tenant_role_permissions_tenant_role_fkey
            FOREIGN KEY (tenant_id, role_id)
            REFERENCES tenant_roles(tenant_id, id)
            ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tenant_members_tenant_role_fkey'
          AND conrelid = 'tenant_members'::regclass
    ) THEN
        ALTER TABLE tenant_members
            ADD CONSTRAINT tenant_members_tenant_role_fkey
            FOREIGN KEY (tenant_id, role_id)
            REFERENCES tenant_roles(tenant_id, id);
    END IF;
END;
$$;

INSERT INTO tenant_roles (id, tenant_id, key, name, system)
VALUES
    ('default-owner', 'default', 'owner', '所有者', true),
    ('default-member', 'default', 'member', '成员', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenant_role_permissions (tenant_id, role_id, permission)
SELECT 'default', 'default-owner', permission
FROM unnest(ARRAY[
    'tenant.members.read', 'tenant.members.manage', 'tenant.roles.manage',
    'tenant.domains.read', 'tenant.domains.manage', 'tenant.settings.read',
    'tenant.settings.manage', 'tenant.apps.read', 'tenant.apps.configure',
    'tenant.billing.read', 'tenant.merchants.manage'
]::text[]) AS permission
ON CONFLICT (tenant_id, role_id, permission) DO NOTHING;

INSERT INTO tenant_members (tenant_id, user_id, role_id, status)
SELECT 'default', id, CASE WHEN role = 'admin' THEN 'default-owner' ELSE 'default-member' END, 'active'
FROM users
ON CONFLICT (tenant_id, user_id) DO NOTHING;

DROP TRIGGER IF EXISTS tenants_set_updated_at ON tenants;
CREATE TRIGGER tenants_set_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at();

DROP TRIGGER IF EXISTS tenant_domains_set_updated_at ON tenant_domains;
CREATE TRIGGER tenant_domains_set_updated_at BEFORE UPDATE ON tenant_domains FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at();

DROP TRIGGER IF EXISTS tenant_roles_set_updated_at ON tenant_roles;
CREATE TRIGGER tenant_roles_set_updated_at BEFORE UPDATE ON tenant_roles FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at();

DROP TRIGGER IF EXISTS tenant_members_set_updated_at ON tenant_members;
CREATE TRIGGER tenant_members_set_updated_at BEFORE UPDATE ON tenant_members FOR EACH ROW EXECUTE FUNCTION vozeb_pro_set_updated_at();
`;

export const POSTGRESQL_SAAS_RESOURCE_SCHEMA_SQL = `
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE generation_tasks SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE generation_tasks ALTER COLUMN tenant_id SET NOT NULL;
DROP INDEX IF EXISTS generation_tasks_user_client_request_idx;
CREATE UNIQUE INDEX IF NOT EXISTS generation_tasks_tenant_user_client_request_idx
ON generation_tasks (tenant_id, user_id, task_type, client_request_id, COALESCE(attempt_no, 0))
WHERE client_request_id IS NOT NULL;

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE generation_logs SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE generation_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE creative_conversations ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE creative_conversations SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE creative_conversations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE creative_assets ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE creative_assets SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE creative_assets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE local_media_assets ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE local_media_assets SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE local_media_assets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE canvas_projects ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE canvas_projects SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE canvas_projects ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE library_assets ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE library_assets SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE library_assets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE drama_projects ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE drama_projects SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE drama_projects ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE published_works ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE published_works SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE published_works ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE billing_orders SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE billing_orders ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS generation_logs_tenant_user_created_idx ON generation_logs (tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_conversations_tenant_user_updated_idx ON creative_conversations (tenant_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS creative_assets_tenant_conversation_created_idx ON creative_assets (tenant_id, conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS local_media_assets_tenant_owner_created_idx ON local_media_assets (tenant_id, owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS canvas_projects_tenant_user_updated_idx ON canvas_projects (tenant_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS library_assets_tenant_user_updated_idx ON library_assets (tenant_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS drama_projects_tenant_user_updated_idx ON drama_projects (tenant_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS published_works_tenant_owner_created_idx ON published_works (tenant_id, owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_orders_tenant_user_created_idx ON billing_orders (tenant_id, user_id, created_at DESC);
`;
