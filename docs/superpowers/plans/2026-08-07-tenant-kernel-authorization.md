# Tenant Kernel and Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add default-tenant backfill, request tenant resolution, tenant memberships, tenant-scoped authorization, and platform/tenant administration boundaries.

**Architecture:** Add SaaS DDL in focused schema modules, preserve global user identities, and resolve a server-owned `TenantContext` for every tenant route. Authorization services consume current user plus tenant membership and expose stable permission guards used by Route Handlers and pages.

**Tech Stack:** Next.js 16.2.12 Route Handlers and Server Components, TypeScript 5, PostgreSQL, Vitest, Ant Design.

## Global Constraints

- PostgreSQL is mandatory for SaaS APIs.
- `users.role = admin` means platform administrator; tenant roles are stored in tenant membership tables.
- Existing data belongs to tenant ID `default`.
- Tenant IDs are server-resolved and never trusted from public request headers.
- Tenant-owned repository methods require `tenantId` as a positional or named argument.
- API responses use `{ code, data, msg }`.
- Every task ends with tests and a commit.

---

## Task 1: Add SaaS Core Schema

**Files:**
- Create: `web/src/lib/server/database/schema-saas-core.ts`
- Modify: `web/src/lib/server/database/schema.ts`
- Modify: `web/src/lib/server/database/postgres.ts`
- Modify: `web/src/lib/server/database/postgres.test.ts`
- Test: `web/src/lib/server/database/schema-saas-core.test.ts`

**Interfaces:**
- Produces: `POSTGRESQL_SAAS_CORE_SCHEMA_SQL: string`
- Consumes: the existing schema prefixing performed by `initializePostgresSchema()`

- [ ] **Step 1: Write the failing schema contract test**

```ts
import { describe, expect, it } from "vitest";
import { POSTGRESQL_SAAS_CORE_SCHEMA_SQL } from "./schema-saas-core";

describe("SaaS core schema", () => {
    it("creates the default tenant, membership, role, and permission tables", () => {
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenants");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("VALUES ('default', 'default', '默认租户'");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenant_members");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenant_roles");
        expect(POSTGRESQL_SAAS_CORE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS tenant_role_permissions");
    });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `pnpm test -- src/lib/server/database/schema-saas-core.test.ts`

Expected: FAIL because `schema-saas-core.ts` does not exist.

- [ ] **Step 3: Add the focused schema module**

```ts
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
`;
```

Import `POSTGRESQL_SAAS_CORE_SCHEMA_SQL` in `schema.ts` and append it after the `users` and session tables are created. Add the five new tables, indexes, and updated-at triggers to the prefix lists in `postgres.ts`.

- [ ] **Step 4: Extend the schema lifecycle assertions**

Add assertions to `postgres.test.ts`:

```ts
expect(ddl).toContain("CREATE TABLE IF NOT EXISTS vozeb_pro_tenants");
expect(ddl).toContain("CREATE TABLE IF NOT EXISTS vozeb_pro_tenant_members");
expect(ddl).toContain("CREATE UNIQUE INDEX IF NOT EXISTS vozeb_pro_tenant_domains_hostname_lower_idx");
expect(ddl).toContain("VALUES ('default', 'default', '默认租户', 'active')");
```

- [ ] **Step 5: Run schema tests**

Run: `pnpm test -- src/lib/server/database/schema-saas-core.test.ts src/lib/server/database/postgres.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/database/schema-saas-core.ts web/src/lib/server/database/schema-saas-core.test.ts web/src/lib/server/database/schema.ts web/src/lib/server/database/postgres.ts web/src/lib/server/database/postgres.test.ts
git commit -m "feat: add SaaS tenant schema"
```

## Task 2: Add Tenant Types and Repository

**Files:**
- Create: `web/src/lib/server/tenant/tenant-types.ts`
- Create: `web/src/lib/server/database/tenant-repository.ts`
- Create: `web/src/lib/server/database/tenant-repository.test.ts`
- Modify: `web/src/lib/server/database/repositories.ts`
- Modify: `web/src/lib/server/database/index.ts`

**Interfaces:**
- Produces: `TenantRecord`, `TenantDomainRecord`, `TenantMemberRecord`, `TenantRepository`
- Produces repository methods: `getById`, `getBySlug`, `getByVerifiedHostname`, `createWithOwner`, `updateStatus`, `getMember`, `listMembers`, `addMember`

- [ ] **Step 1: Write repository isolation tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { TenantRepository } from "./tenant-repository";

describe("TenantRepository", () => {
    it("always scopes member lookups by tenant", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const repository = new TenantRepository({ query });

        await repository.getMember("tenant-a", "user-one");

        expect(query).toHaveBeenCalledWith(expect.stringContaining("tenant_id = $1 AND user_id = $2"), ["tenant-a", "user-one"]);
    });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm test -- src/lib/server/database/tenant-repository.test.ts`

Expected: FAIL because the repository is missing.

- [ ] **Step 3: Add stable domain types**

```ts
export type TenantStatus = "active" | "disabled";
export type TenantDomainStatus = "pending" | "verified" | "disabled";
export type TenantMemberStatus = "active" | "disabled";

export type TenantRecord = {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
    ownerUserId?: string;
    settings: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

export type TenantMemberRecord = {
    tenantId: string;
    userId: string;
    roleId: string;
    roleKey: string;
    status: TenantMemberStatus;
    permissions: string[];
};
```

- [ ] **Step 4: Implement the repository with parameterized SQL**

```ts
export class TenantRepository {
    constructor(private readonly db: QueryExecutor) {}

    async getMember(tenantId: string, userId: string): Promise<TenantMemberRecord | null> {
        const result = await this.db.query(
            `SELECT tm.*, tr.key AS role_key,
                    coalesce(array_agg(trp.permission) FILTER (WHERE trp.permission IS NOT NULL), '{}') AS permissions
             FROM tenant_members tm
             JOIN tenant_roles tr ON tr.id = tm.role_id AND tr.tenant_id = tm.tenant_id
             LEFT JOIN tenant_role_permissions trp ON trp.role_id = tr.id AND trp.tenant_id = tm.tenant_id
             WHERE tm.tenant_id = $1 AND tm.user_id = $2
             GROUP BY tm.tenant_id, tm.user_id, tm.role_id, tm.status, tm.joined_at, tm.updated_at, tr.key`,
            [tenantId, userId],
        );
        return result.rows[0] ? mapTenantMember(result.rows[0]) : null;
    }
}
```

Implement the remaining methods with the same explicit `tenantId` boundary. Export the repository through `createPostgresRepositories()` as `tenants`.

`createWithOwner` must run in one PostgreSQL transaction: insert the tenant, create the built-in `owner` role, insert its permission rows, and add the owner membership. A failure in any step rolls back all four writes.

- [ ] **Step 5: Run repository tests**

Run: `pnpm test -- src/lib/server/database/tenant-repository.test.ts src/lib/server/database/repositories.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/tenant/tenant-types.ts web/src/lib/server/database/tenant-repository.ts web/src/lib/server/database/tenant-repository.test.ts web/src/lib/server/database/repositories.ts web/src/lib/server/database/index.ts
git commit -m "feat: add tenant repository"
```

## Task 3: Resolve Trusted Tenant Context

**Files:**
- Create: `web/src/lib/server/tenant/tenant-host.ts`
- Create: `web/src/lib/server/tenant/tenant-host.test.ts`
- Create: `web/src/lib/server/tenant/tenant-context.ts`
- Create: `web/src/lib/server/tenant/tenant-context.test.ts`
- Modify: `web/src/proxy.ts`

**Interfaces:**
- Produces: `TenantContext`
- Produces: `resolveTenantLookup(request: Request): { hostname?: string; slug?: string }`
- Produces: `getTenantContext(request: Request, options?: TenantContextOptions): Promise<TenantContext>`

- [ ] **Step 1: Write host and path precedence tests**

```ts
it("prefers a verified host lookup over a path slug", () => {
    const request = new Request("https://studio.example.com/t/path-tenant/apps");
    expect(resolveTenantLookup(request)).toEqual({ hostname: "studio.example.com", slug: "path-tenant" });
});

it("does not read a public tenant id header", () => {
    const request = new Request("https://example.com/apps", { headers: { "x-tenant-id": "attacker" } });
    expect(resolveTenantLookup(request)).toEqual({ hostname: "example.com" });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/lib/server/tenant/tenant-host.test.ts src/lib/server/tenant/tenant-context.test.ts`

Expected: FAIL because tenant resolution modules are missing.

- [ ] **Step 3: Implement pure request lookup**

```ts
export function resolveTenantLookup(request: Request) {
    const url = new URL(request.url);
    const slugMatch = url.pathname.match(/^\/t\/([a-z0-9][a-z0-9-]{0,62})(?:\/|$)/i);
    const forwardedHost = getTrustedProxyHops() > 0 ? request.headers.get("x-forwarded-host") : null;
    return {
        hostname: normalizeHostname(forwardedHost || request.headers.get("host") || url.host),
        slug: slugMatch?.[1]?.toLowerCase(),
    };
}
```

Import `getTrustedProxyHops` from the existing proxy trust configuration. Tests must prove an untrusted `x-forwarded-host` value is ignored.

- [ ] **Step 4: Implement server tenant resolution**

```ts
export type TenantContext = {
    tenant: TenantRecord;
    source: "domain" | "path" | "default";
    member?: TenantMemberRecord;
};

export async function getTenantContext(request: Request, options: TenantContextOptions = {}): Promise<TenantContext> {
    if (!isPostgresDatabaseEnabled()) throw new TenantContextError("SaaS 功能需要 PostgreSQL", 501, "tenant.postgres_required");
    const lookup = resolveTenantLookup(request);
    const repos = createPostgresRepositories();
    const tenant =
        (lookup.hostname ? await repos.tenants.getByVerifiedHostname(lookup.hostname) : null) ||
        (lookup.slug ? await repos.tenants.getBySlug(lookup.slug) : null) ||
        (options.allowDefault === false ? null : await repos.tenants.getById("default"));
    if (!tenant || tenant.status !== "active") throw new TenantContextError("租户不存在或已停用", 404, "tenant.not_found");
    const user = options.user || (await getCurrentUser(request));
    const member = user ? await repos.tenants.getMember(tenant.id, user.id) : null;
    if (options.requireMembership && (!member || member.status !== "active")) {
        throw new TenantContextError("当前用户不是租户成员", 403, "tenant.membership_required");
    }
    return { tenant, member: member || undefined, source: lookup.hostname ? "domain" : lookup.slug ? "path" : "default" };
}
```

- [ ] **Step 5: Strip spoofable internal headers in the proxy**

Before returning `NextResponse.next()`, create request headers and delete `x-vozeb-tenant-id` and `x-vozeb-tenant-signature`. Pass the sanitized headers through `NextResponse.next({ request: { headers } })`.

- [ ] **Step 6: Run tests**

Run: `pnpm test -- src/lib/server/tenant`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/lib/server/tenant web/src/proxy.ts
git commit -m "feat: resolve trusted tenant context"
```

## Task 4: Add Permission Catalog and Guards

**Files:**
- Create: `web/src/lib/server/authorization/permission-catalog.ts`
- Create: `web/src/lib/server/authorization/authorization-service.ts`
- Create: `web/src/lib/server/authorization/authorization-service.test.ts`
- Create: `web/src/app/api/_shared/api-response.ts`
- Create: `web/src/app/api/_shared/api-response.test.ts`

**Interfaces:**
- Produces: `PlatformPermission`, `TenantPermission`
- Produces: dynamic application permission keys in the form `tenant.apps.use.{appKey}`
- Produces: `requirePlatformPermission(request, permission)`
- Produces: `requireTenantPermission(request, permission)`
- Produces: `apiOk(data, status?)` and `apiError(error, fallback, event)`

- [ ] **Step 1: Write authorization tests**

```ts
it("rejects a global user from platform permissions", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-one", role: "user" });
    await expect(requirePlatformPermission(request(), "platform.tenants.read")).rejects.toMatchObject({ status: 403 });
});

it("accepts an active tenant member with the requested permission", async () => {
    mocks.getTenantContext.mockResolvedValue({
        tenant: { id: "tenant-a", status: "active" },
        member: { status: "active", permissions: ["tenant.members.manage"] },
    });
    await expect(requireTenantPermission(request(), "tenant.members.manage")).resolves.toMatchObject({ tenant: { id: "tenant-a" } });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/lib/server/authorization src/app/api/_shared/api-response.test.ts`

Expected: FAIL because the guards and response helper are missing.

- [ ] **Step 3: Add the explicit permission catalog**

```ts
export const PLATFORM_PERMISSIONS = [
    "platform.tenants.read",
    "platform.tenants.manage",
    "platform.apps.publish",
    "platform.billing.read",
    "platform.billing.manage",
    "platform.settings.manage",
] as const;

export const TENANT_PERMISSIONS = [
    "tenant.members.read",
    "tenant.members.manage",
    "tenant.roles.manage",
    "tenant.apps.read",
    "tenant.apps.configure",
    "tenant.billing.read",
    "tenant.merchants.manage",
] as const;

export type TenantPermission =
    | (typeof TENANT_PERMISSIONS)[number]
    | `tenant.apps.use.${string}`;
```

- [ ] **Step 4: Implement the guards**

```ts
export async function requirePlatformPermission(request: Request, permission: PlatformPermission) {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthorizationError("请先登录", 401, "auth.required");
    if (user.role !== "admin") throw new AuthorizationError("需要平台管理员权限", 403, "platform.permission_denied");
    return { user, permission };
}

export async function requireTenantPermission(request: Request, permission: TenantPermission) {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthorizationError("请先登录", 401, "auth.required");
    const context = await getTenantContext(request, { user, requireMembership: true });
    if (!context.member?.permissions.includes(permission) && context.member?.roleKey !== "owner") {
        throw new AuthorizationError("租户权限不足", 403, "tenant.permission_denied");
    }
    return { user, ...context, permission };
}
```

Implement `apiOk` as `{ code: 0, data, msg: "" }`. Match the existing commerce response convention by returning the HTTP status as numeric `code` for `AuthorizationError` and `TenantContextError`.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- src/lib/server/authorization src/app/api/_shared/api-response.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/authorization web/src/app/api/_shared
git commit -m "feat: add platform and tenant permission guards"
```

## Task 5: Add Platform Tenant APIs

**Files:**
- Create: `web/src/app/api/admin/tenants/route.ts`
- Create: `web/src/app/api/admin/tenants/route.test.ts`
- Create: `web/src/app/api/admin/tenants/[id]/route.ts`
- Create: `web/src/app/api/admin/tenants/[id]/route.test.ts`
- Modify: `web/src/lib/server/database/tenant-repository.ts`

**Interfaces:**
- Consumes: `requirePlatformPermission`, `apiOk`, `apiError`, `TenantRepository`
- Produces: list, create, rename, enable, and disable tenant APIs

- [ ] **Step 1: Write route authorization and creation tests**

```ts
it("creates a tenant through the platform permission guard", async () => {
    mocks.requirePlatformPermission.mockResolvedValue({ user: { id: "admin-one" } });
    mocks.createWithOwner.mockResolvedValue({ id: "tenant-a", slug: "tenant-a", name: "Tenant A", status: "active" });
    const response = await POST(new Request("http://localhost/api/admin/tenants", {
        method: "POST",
        body: JSON.stringify({ slug: "tenant-a", name: "Tenant A" }),
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ code: 0, data: { tenant: { id: "tenant-a" } } });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/app/api/admin/tenants`

Expected: FAIL because the routes are missing.

- [ ] **Step 3: Implement create and list routes**

```ts
export async function POST(request: Request) {
    try {
        const { user } = await requirePlatformPermission(request, "platform.tenants.manage");
        const body = await request.json();
        const tenant = await createPostgresRepositories().tenants.createWithOwner({
            slug: String(body.slug || ""),
            name: String(body.name || ""),
            ownerUserId: typeof body.ownerUserId === "string" ? body.ownerUserId : user.id,
        });
        return apiOk({ tenant }, 201);
    } catch (error) {
        return apiError(error, "创建租户失败", "platform.tenant.create");
    }
}
```

Add pagination to `GET`; add name and status changes to `[id]/route.ts`. Record audit actions `platform.tenant.create`, `platform.tenant.update`, and `platform.tenant.status`.

- [ ] **Step 4: Run route tests**

Run: `pnpm test -- src/app/api/admin/tenants`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/src/app/api/admin/tenants web/src/lib/server/database/tenant-repository.ts
git commit -m "feat: add platform tenant APIs"
```

## Task 6: Add Tenant Member and Role APIs

**Files:**
- Create: `web/src/app/api/tenant/context/route.ts`
- Create: `web/src/app/api/tenant/context/route.test.ts`
- Create: `web/src/app/api/tenant/members/route.ts`
- Create: `web/src/app/api/tenant/members/route.test.ts`
- Create: `web/src/app/api/tenant/roles/route.ts`
- Create: `web/src/app/api/tenant/roles/route.test.ts`
- Modify: `web/src/lib/server/database/tenant-repository.ts`

**Interfaces:**
- Consumes: tenant permission guards
- Produces: current tenant context, member management, and role management APIs

- [ ] **Step 1: Write cross-tenant mutation tests**

```ts
it("passes only the resolved tenant id to member creation", async () => {
    mocks.requireTenantPermission.mockResolvedValue({ tenant: { id: "tenant-a" }, user: { id: "owner" } });
    await POST(new Request("https://a.example.com/api/tenant/members", {
        method: "POST",
        body: JSON.stringify({ tenantId: "tenant-b", userId: "user-two", roleId: "role-member" }),
    }));
    expect(mocks.addMember).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", userId: "user-two" }));
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/app/api/tenant`

Expected: FAIL because the routes are missing.

- [ ] **Step 3: Implement tenant context and member routes**

`GET /api/tenant/context` returns the serialized tenant and current membership. `POST /api/tenant/members` ignores any body tenant ID and uses the guard result:

```ts
const access = await requireTenantPermission(request, "tenant.members.manage");
const member = await createPostgresRepositories().tenants.addMember({
    tenantId: access.tenant.id,
    userId: String(body.userId || ""),
    roleId: String(body.roleId || ""),
    status: "active",
});
```

- [ ] **Step 4: Implement role validation**

Reject platform permission strings in tenant roles and require every permission to be present in `TENANT_PERMISSIONS`.

- [ ] **Step 5: Run route and repository tests**

Run: `pnpm test -- src/app/api/tenant src/lib/server/database/tenant-repository.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/app/api/tenant web/src/lib/server/database/tenant-repository.ts
git commit -m "feat: add tenant member and role APIs"
```

## Task 7: Tenant-Scope the First Resource Roots

**Files:**
- Modify: `web/src/lib/server/database/schema-saas-core.ts`
- Modify: `web/src/lib/server/database/postgres.test.ts`
- Modify: `web/src/lib/server/generation-task-types.ts`
- Modify: `web/src/lib/server/generation-task-store.ts`
- Modify: `web/src/lib/server/generation-task-store.test.ts`
- Modify: `web/src/lib/server/database/content-repository.ts`
- Create: `web/src/lib/server/database/content-repository.tenant.test.ts`
- Create: `web/scripts/saas-default-tenant-backfill.mjs`
- Create: `web/scripts/lib/saas-default-tenant-backfill-core.mjs`
- Create: `web/scripts/lib/saas-default-tenant-backfill-core.test.ts`
- Modify: `web/package.json`
- Modify: `web/README.md`

**Interfaces:**
- Changes: `StoredGenerationTaskRecord.tenantId: string`
- Changes: generation task create/read/list methods require tenant ID for non-platform access

- [ ] **Step 1: Write task isolation tests**

```ts
it("includes tenant id in request idempotency lookup", async () => {
    mocks.postgresQuery.mockResolvedValue({ rows: [] });
    await getStoredGenerationTaskByRequest("image", "tenant-a", "user-one", "req-one", 0);
    expect(mocks.postgresQuery).toHaveBeenCalledWith(
        expect.stringContaining("tenant_id = $1 AND user_id = $2"),
        ["tenant-a", "user-one", "image", "req-one", 0],
    );
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/lib/server/generation-task-store.test.ts`

Expected: FAIL because the current function has no tenant argument.

- [ ] **Step 3: Add nullable tenant columns without startup data mutation**

Append SQL for the first roots:

```sql
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
DROP INDEX IF EXISTS generation_tasks_user_client_request_idx;
CREATE UNIQUE INDEX IF NOT EXISTS generation_tasks_tenant_user_client_request_idx
ON generation_tasks (tenant_id, user_id, task_type, client_request_id, coalesce(attempt_no, 0))
WHERE client_request_id IS NOT NULL;

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);

ALTER TABLE creative_conversations ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);

ALTER TABLE creative_assets ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);

ALTER TABLE local_media_assets ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);

ALTER TABLE canvas_projects ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);

ALTER TABLE library_assets ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);

ALTER TABLE drama_projects ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);

ALTER TABLE published_works ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);

ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
```

Do not execute `UPDATE` or `ALTER COLUMN ... SET NOT NULL` from application startup schema initialization.

- [ ] **Step 4: Add the controlled default-tenant backfill**

The command has exact modes:

```json
"migrate:saas:backfill": "node --env-file-if-exists=.env.local scripts/saas-default-tenant-backfill.mjs"
```

```ts
export const DEFAULT_TENANT = {
    id: "default",
    slug: "default",
    name: "Default Tenant",
} as const;
```

`--dry-run` is the default and prints database name, row counts by table, null counts, and planned constraints without writing. Write mode requires `--write --confirm-database <database-name>`, updates only null `tenant_id` values in the listed root tables, verifies zero nulls and no parent/child tenant conflicts, and then executes `ALTER COLUMN tenant_id SET NOT NULL` for those tables. The command aborts before writes when any orphan or cross-tenant conflict is detected.

- [ ] **Step 5: Change task store signatures**

Use:

```ts
export async function getStoredGenerationTaskByRequest<T>(
    type: GenerationTaskType,
    tenantId: string,
    userId: string,
    clientRequestId: string,
    attemptNo?: number,
): Promise<T | null>
```

Add `tenant_id` to inserts, selects, lists, upstream lookup, summaries, update, cancellation, recovery, and retention queries. Platform admin list operations may pass an explicit `tenantId` filter or `includeAllTenants: true`; user operations never use the all-tenant path.

- [ ] **Step 6: Update direct callers**

For image, video, audio, text, Agent, Canvas, and drama routes, resolve `TenantContext` before task lookup and pass `context.tenant.id`. Do not accept tenant IDs from request bodies.

- [ ] **Step 7: Run focused tests and backfill dry run**

Run:

```powershell
pnpm test -- src/lib/server/generation-task-store.test.ts src/lib/server/generation-task-authorization.test.ts src/lib/server/database/content-repository.tenant.test.ts scripts/lib/saas-default-tenant-backfill-core.test.ts src/app/api/image-tasks src/app/api/video-tasks src/app/api/audio-tasks src/app/api/text-tasks
pnpm migrate:saas:backfill -- --dry-run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add web/src/lib/server/database/schema-saas-core.ts web/src/lib/server/database/postgres.test.ts web/src/lib/server/generation-task-types.ts web/src/lib/server/generation-task-store.ts web/src/lib/server/generation-task-store.test.ts web/src/lib/server/database/content-repository.ts web/src/lib/server/database/content-repository.tenant.test.ts web/scripts/saas-default-tenant-backfill.mjs web/scripts/lib/saas-default-tenant-backfill-core.mjs web/scripts/lib/saas-default-tenant-backfill-core.test.ts web/package.json web/README.md web/src/app/api
git commit -m "feat: tenant-scope generation and content roots"
```

## Task 8: Add Platform and Tenant Administration Pages

**Files:**
- Create: `web/src/app/tenant-admin/page.tsx`
- Create: `web/src/components/tenant-admin/tenant-admin-shell.tsx`
- Create: `web/src/components/tenant-admin/tenant-members-section.tsx`
- Create: `web/src/components/tenant-admin/tenant-roles-section.tsx`
- Create: `web/src/services/api/tenant-admin.ts`
- Create: `web/src/services/api/admin-tenants.ts`
- Create: `web/src/services/api/api-envelope.ts`
- Create: `web/src/services/api/api-envelope.test.ts`
- Create: `web/src/components/admin/admin-tenants-section.tsx`
- Create: `web/src/lib/server/tenant/tenant-page-context.ts`
- Modify: `web/src/components/admin/admin-sections.ts`
- Modify: `web/src/components/admin/admin-section-nav.tsx`
- Test: `web/src/components/tenant-admin/tenant-admin-shell.test.tsx`
- Test: `web/src/services/api/tenant-admin.test.ts`
- Test: `web/src/services/api/admin-tenants.test.ts`
- Test: `web/src/components/admin/admin-tenants-section.test.tsx`

**Interfaces:**
- Consumes: platform tenant APIs and tenant member/role APIs
- Produces: `/tenant-admin` tenant administration UI

- [ ] **Step 1: Write page-access and navigation tests**

```tsx
it("shows member and role sections without platform settings", () => {
    render(<TenantAdminShell initialContext={context} />);
    expect(screen.getByText("成员")).toBeInTheDocument();
    expect(screen.getByText("角色")).toBeInTheDocument();
    expect(screen.queryByText("系统渠道")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test -- src/components/tenant-admin src/services/api/tenant-admin.test.ts`

Expected: FAIL because the tenant admin UI is missing.

- [ ] **Step 3: Implement tenant admin API client**

```ts
// api-envelope.ts
export type ApiEnvelope<T> = { code: number; data: T; msg: string };

export async function requestApiData<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
        ...init,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...init.headers },
    });
    const payload = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || payload.code !== 0) throw new Error(payload.msg || `Request failed: ${response.status}`);
    return payload.data;
}

// tenant-admin.ts
export async function getTenantAdminContext() {
    return requestApiData<TenantContextResponse>("/api/tenant/context");
}

export async function addTenantMember(input: { userId: string; roleId: string }) {
    return requestApiData<TenantMemberResponse>("/api/tenant/members", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
```

Import `requestApiData` from `api-envelope.ts` in both `tenant-admin.ts` and `admin-tenants.ts`.

- [ ] **Step 4: Implement the server page guard**

Implement `tenant-page-context.ts` so Server Components can build a request without trusting client data:

```ts
export async function getTenantPageContext(pathname: string) {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host") || "localhost";
    const request = new Request(`http://${host}${pathname}`, { headers: new Headers(requestHeaders) });
    return getTenantContext(request, { requireMembership: true });
}
```

In `tenant-admin/page.tsx`, call `getCurrentUser()`, then `getTenantPageContext("/tenant-admin")`. Redirect unauthenticated users to `/login?next=/tenant-admin` and non-members to `/`.

- [ ] **Step 5: Add platform tenant navigation**

Add a `tenants` section to the existing `/admin` dashboard, render `AdminTenantsSection`, and use `admin-tenants.ts` for list/create/status changes. Keep tenant members, roles, and tenant application settings out of `/admin`.

- [ ] **Step 6: Run UI tests and typecheck**

Run: `pnpm test -- src/components/tenant-admin src/services/api/api-envelope.test.ts src/services/api/tenant-admin.test.ts src/services/api/admin-tenants.test.ts src/components/admin/admin-tenants-section.test.tsx src/components/admin/admin-sections.test.ts`

Run: `pnpm typecheck`

Expected: both commands PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/app/tenant-admin web/src/components/tenant-admin web/src/services/api/api-envelope.ts web/src/services/api/api-envelope.test.ts web/src/services/api/tenant-admin.ts web/src/services/api/tenant-admin.test.ts web/src/services/api/admin-tenants.ts web/src/services/api/admin-tenants.test.ts web/src/components/admin/admin-tenants-section.tsx web/src/components/admin/admin-tenants-section.test.tsx web/src/lib/server/tenant/tenant-page-context.ts web/src/components/admin/admin-sections.ts web/src/components/admin/admin-section-nav.tsx web/src/components/admin/admin-sections.test.ts
git commit -m "feat: add tenant administration console"
```

## Task 9: Verify Tenant Kernel Exit Criteria

**Files:**
- Create: `web/e2e/tenant-isolation.spec.ts`
- Modify: `web/e2e/support.ts`
- Modify: `web/scripts/disaster-backup.mjs`
- Modify: `web/scripts/disaster-restore.mjs`
- Modify: `web/src/lib/server/database/full-snapshot-boundary.test.ts`

**Interfaces:**
- Verifies: tenant isolation, backup coverage, and existing default-tenant behavior

- [ ] **Step 1: Extend backup table coverage**

Add `tenants`, `tenant_domains`, `tenant_roles`, `tenant_role_permissions`, and `tenant_members` to disaster backup and restore table manifests. Assert them in `full-snapshot-boundary.test.ts`.

- [ ] **Step 2: Add the E2E isolation scenario**

```ts
test("tenant A cannot read tenant B task or asset", async ({ browser }) => {
    const tenantA = await browser.newContext({
        baseURL: requiredEnv("E2E_TENANT_A_URL"),
        storageState: requiredEnv("E2E_TENANT_A_STORAGE_STATE"),
    });
    const tenantB = await browser.newContext({
        baseURL: requiredEnv("E2E_TENANT_B_URL"),
        storageState: requiredEnv("E2E_TENANT_B_STORAGE_STATE"),
    });
    const task = await createTenantImageTask(tenantA.request, "tenant isolation");
    const response = await tenantB.request.get(`/api/image-tasks/${task.id}`);
    expect(response.status()).toBe(404);
});
```

Add these exact helpers to `e2e/support.ts`:

```ts
export function requiredEnv(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

export async function createTenantImageTask(request: APIRequestContext, prompt: string) {
    const response = await request.post("/api/image-tasks", {
        headers: { "X-VOZEB-PRO-Client-Request-Id": `tenant-isolation:${crypto.randomUUID()}` },
        data: { prompt },
    });
    if (!response.ok()) throw new Error(`Unable to create image task: ${response.status()} ${await response.text()}`);
    return ((await response.json()) as { task: { id: string } }).task;
}
```

- [ ] **Step 3: Run the full phase gate**

Run:

```powershell
$env:DATABASE_URL='postgres://vozeb:vozeb@127.0.0.1:5432/vozeb_saas_test'
$env:VOZEB_PRO_DATABASE_PROVIDER='postgres'
pnpm migrate:saas:backfill -- --write --confirm-database vozeb_saas_test
pnpm typecheck
pnpm lint
pnpm test
pnpm e2e -- tenant-isolation.spec.ts
pnpm build
```

Expected: every command exits with code `0`.

- [ ] **Step 4: Commit**

```powershell
git add web/e2e/tenant-isolation.spec.ts web/e2e/support.ts web/scripts/disaster-backup.mjs web/scripts/disaster-restore.mjs web/src/lib/server/database/full-snapshot-boundary.test.ts
git commit -m "test: verify tenant kernel isolation"
```
