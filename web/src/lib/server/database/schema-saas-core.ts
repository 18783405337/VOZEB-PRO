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
    UNIQUE (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS tenant_role_permissions (
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id text NOT NULL REFERENCES tenant_roles(id) ON DELETE CASCADE,
    permission text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, role_id, permission)
);

CREATE TABLE IF NOT EXISTS tenant_members (
    tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id text NOT NULL REFERENCES tenant_roles(id),
    status text NOT NULL DEFAULT 'active',
    joined_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id),
    CONSTRAINT tenant_members_status CHECK (status IN ('active', 'disabled'))
);

INSERT INTO tenant_roles (id, tenant_id, key, name, system)
VALUES
    ('default-owner', 'default', 'owner', '所有者', true),
    ('default-member', 'default', 'member', '成员', true)
ON CONFLICT (id) DO NOTHING;

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
