# Application Center and AI Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned application catalog, tenant installation and configuration, and a single app execution adapter that creates tenant-scoped VOZEB Generation Tasks.

**Architecture:** Executable application definitions remain reviewed TypeScript modules. PostgreSQL stores published versions, tenant installations, configuration overrides, permissions, and price snapshots. All application submissions pass through `submitAppRun`, which resolves tenant access and immutable execution metadata before delegating to the existing Generation Task infrastructure.

**Tech Stack:** Next.js 16.2.12 Route Handlers and Server Components, TypeScript 5, PostgreSQL, Vitest, Playwright, Ant Design 6.

## Global Constraints

- Tasks 1-5 may begin after Tenant Kernel Task 5 stabilizes tenant and authorization APIs.
- Task 6 requires Tenant Kernel Task 7 and a successful write-mode default-tenant backfill on the target database.
- An application key is stable; a version is immutable after publication.
- Database records may select a reviewed workflow and renderer but may not contain executable tenant code.
- Tenant configuration is validated against the published application schema.
- Secrets are referenced by server-side secret IDs and are never returned to the browser.
- Application access is enforced by the server even when navigation links are hidden.
- Every Generation Task created through the adapter stores tenant, app version, workflow, collection mode, and pricing snapshots.
- Billing integration is represented by a stable port in this plan; Plan 3 supplies the ledger-backed implementation.
- Preserve existing chat, canvas, drama, and direct generation entry points.
- Implement with TDD and commit after every task.

---

## Task 1: Add Application Center Schema

**Files:**

- Create: `web/src/lib/server/database/schema-application-center.ts`
- Modify: `web/src/lib/server/database/schema.ts`
- Modify: `web/src/lib/server/database/postgres.ts`
- Modify: `web/src/lib/server/database/postgres.test.ts`

- [ ] **Step 1: Add a failing schema lifecycle test**

Assert that `POSTGRES_TABLES` contains these five prefixed tables and that an initialize/drop cycle succeeds:

```ts
const applicationTables = [
    "apps",
    "app_versions",
    "tenant_apps",
    "tenant_app_settings",
    "tenant_app_pricing",
];

for (const table of applicationTables) {
    expect(POSTGRES_TABLES).toContain(table);
}
```

- [ ] **Step 2: Run the focused test and confirm failure**

```powershell
cd D:\homeWork\saas-api\VOZEB-PRO\web
pnpm test -- src/lib/server/database/postgres.test.ts
```

Expected: failure because the application tables do not exist in `POSTGRES_TABLES`.

- [ ] **Step 3: Define additive PostgreSQL DDL**

Export `POSTGRESQL_APPLICATION_CENTER_SCHEMA_SQL` with:

```sql
CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    app_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'disabled')),
    current_version TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_versions (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id),
    version TEXT NOT NULL,
    workflow_key TEXT NOT NULL,
    renderer_key TEXT NOT NULL,
    definition_json JSONB NOT NULL,
    published_at BIGINT,
    created_at BIGINT NOT NULL,
    UNIQUE (app_id, version)
);

CREATE TABLE IF NOT EXISTS tenant_apps (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    app_id TEXT NOT NULL REFERENCES apps(id),
    selected_version_id TEXT NOT NULL REFERENCES app_versions(id),
    status TEXT NOT NULL CHECK (status IN ('enabled', 'disabled')),
    installed_by TEXT NOT NULL REFERENCES users(id),
    installed_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (tenant_id, app_id)
);

CREATE TABLE IF NOT EXISTS tenant_app_settings (
    id TEXT PRIMARY KEY,
    tenant_app_id TEXT NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
    settings_json JSONB NOT NULL,
    secret_refs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT NOT NULL REFERENCES users(id),
    updated_at BIGINT NOT NULL,
    UNIQUE (tenant_app_id)
);

CREATE TABLE IF NOT EXISTS tenant_app_pricing (
    id TEXT PRIMARY KEY,
    tenant_app_id TEXT NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    sale_unit TEXT NOT NULL,
    sale_amount BIGINT NOT NULL CHECK (sale_amount >= 0),
    collection_mode TEXT NOT NULL CHECK (collection_mode IN ('platform', 'tenant')),
    updated_by TEXT NOT NULL REFERENCES users(id),
    updated_at BIGINT NOT NULL,
    UNIQUE (tenant_app_id)
);
```

- [ ] **Step 4: Wire schema and lifecycle metadata**

Import the new SQL into `schema.ts` after the SaaS core schema. Add the five table names and their index names to `postgres.ts`. Update the expected table count in `postgres.test.ts` from the post-Plan-1 value of `64` to `69`.

- [ ] **Step 5: Run database tests**

```powershell
pnpm test -- src/lib/server/database/postgres.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/database/schema-application-center.ts web/src/lib/server/database/schema.ts web/src/lib/server/database/postgres.ts web/src/lib/server/database/postgres.test.ts
git commit -m "feat: add application center schema"
```

---

## Task 2: Define the Reviewed Application Registry

**Files:**

- Create: `web/src/lib/apps/app-definition.ts`
- Create: `web/src/lib/apps/app-registry.ts`
- Create: `web/src/lib/apps/app-registry.test.ts`
- Create: `web/src/lib/apps/definitions/background-removal.ts`
- Create: `web/src/lib/apps/definitions/product-image.ts`
- Create: `web/src/lib/apps/definitions/product-promo-video.ts`

- [ ] **Step 1: Write registry contract tests**

Cover duplicate keys, unknown workflow keys, immutable lookup results, and lookup by key/version.

```ts
expect(() => createAppRegistry([backgroundRemoval, backgroundRemoval]))
    .toThrow("Duplicate application version: background-removal@1.0.0");

expect(appRegistry.get("background-removal", "1.0.0")?.workflowKey)
    .toBe("background-removal.v1");
```

- [ ] **Step 2: Run the test and confirm failure**

```powershell
pnpm test -- src/lib/apps/app-registry.test.ts
```

Expected: failure because the registry does not exist.

- [ ] **Step 3: Add stable TypeScript contracts**

```ts
export type AppField =
    | { key: string; kind: "text"; label: string; required: boolean; maxLength?: number }
    | { key: string; kind: "image"; label: string; required: boolean; maxItems?: number }
    | { key: string; kind: "select"; label: string; required: boolean; options: readonly string[] }
    | { key: string; kind: "number"; label: string; required: boolean; min?: number; max?: number };

export type AppDefinition = Readonly<{
    key: string;
    version: string;
    name: string;
    category: string;
    capabilities: readonly string[];
    permissions: readonly string[];
    inputSchema: readonly AppField[];
    outputSchema: Readonly<{ kind: "image" | "video" | "asset-set" }>;
    workflowKey: string;
    billingMetric: "task" | "image" | "video-second" | "workflow-step";
    defaultPricing: Readonly<{ currency: "POINT"; saleUnit: string; saleAmount: number }>;
    renderer: Readonly<{ kind: "schema" } | { kind: "custom"; key: string }>;
}>;
```

- [ ] **Step 4: Register the three pilot definitions**

Use concrete version `1.0.0` and workflow keys:

```ts
export const PILOT_WORKFLOW_KEYS = [
    "background-removal.v1",
    "product-image.v1",
    "product-promo-video.v1",
] as const;
```

The workflows may initially return `not_configured` from the runtime until Plan 4 implements them, but registry validation and publication are complete here.

- [ ] **Step 5: Run tests and typecheck**

```powershell
pnpm test -- src/lib/apps/app-registry.test.ts
pnpm typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/apps
git commit -m "feat: add reviewed application registry"
```

---

## Task 3: Add Application Repositories and Configuration Resolution

**Files:**

- Create: `web/src/lib/server/database/app-center-repository.ts`
- Create: `web/src/lib/server/database/app-center-repository.test.ts`
- Create: `web/src/lib/server/apps/app-center-service.ts`
- Create: `web/src/lib/server/apps/app-center-service.test.ts`
- Create: `web/src/lib/server/apps/app-config-resolver.ts`
- Create: `web/src/lib/server/apps/app-config-resolver.test.ts`
- Modify: `web/src/lib/server/database/repositories.ts`

- [ ] **Step 1: Write tenant isolation and precedence tests**

Test that tenant A cannot load tenant B's installation and that configuration merges in this order:

```ts
expect(resolveAppConfig({
    platformDefaults: { quality: "standard", count: 1 },
    tenantOverrides: { quality: "high" },
    installSettings: { count: 2 },
    requestOverrides: { count: 3 },
    allowedRequestOverrideKeys: ["count"],
})).toEqual({ quality: "high", count: 3 });
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
pnpm test -- src/lib/server/apps src/lib/server/database/app-center-repository.test.ts
```

Expected: failure because repositories and resolver do not exist.

- [ ] **Step 3: Implement repository interfaces**

```ts
export interface AppCenterRepository {
    publish(input: PublishAppVersionInput): Promise<PublishedAppVersion>;
    listPublished(): Promise<PublishedAppVersion[]>;
    getPublished(appKey: string, version?: string): Promise<PublishedAppVersion | null>;
    install(tenantId: string, input: InstallTenantAppInput): Promise<TenantApp>;
    setStatus(tenantId: string, tenantAppId: string, status: "enabled" | "disabled"): Promise<TenantApp>;
    saveSettings(tenantId: string, tenantAppId: string, input: TenantAppSettingsInput): Promise<void>;
    savePricing(tenantId: string, tenantAppId: string, input: TenantAppPricingInput): Promise<void>;
    getTenantApp(tenantId: string, appKey: string): Promise<TenantAppDetails | null>;
    listTenantApps(tenantId: string): Promise<TenantAppDetails[]>;
}
```

All tenant SQL statements must include `tenant_id = $n`. Register the repository in `createPostgresRepositories()`.

- [ ] **Step 4: Implement application service validation**

`publishAppVersion` must reject a database definition that differs from the reviewed registry for the same key/version. `installTenantApp` must reject unpublished versions. `saveTenantAppSettings` must validate field keys and primitive types from `inputSchema`.

- [ ] **Step 5: Run tests**

```powershell
pnpm test -- src/lib/server/apps src/lib/server/database/app-center-repository.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/apps web/src/lib/server/database/app-center-repository.ts web/src/lib/server/database/app-center-repository.test.ts web/src/lib/server/database/repositories.ts
git commit -m "feat: add tenant application services"
```

---

## Task 4: Add Platform and Tenant Application APIs

**Files:**

- Create: `web/src/app/api/admin/apps/route.ts`
- Create: `web/src/app/api/admin/apps/route.test.ts`
- Create: `web/src/app/api/admin/apps/[appKey]/versions/route.ts`
- Create: `web/src/app/api/admin/apps/[appKey]/versions/route.test.ts`
- Create: `web/src/app/api/tenant/apps/route.ts`
- Create: `web/src/app/api/tenant/apps/route.test.ts`
- Create: `web/src/app/api/tenant/apps/[appKey]/route.ts`
- Create: `web/src/app/api/tenant/apps/[appKey]/route.test.ts`
- Create: `web/src/app/api/tenant/apps/[appKey]/settings/route.ts`
- Create: `web/src/app/api/tenant/apps/[appKey]/pricing/route.ts`

- [ ] **Step 1: Write authorization-first route tests**

Cover `401`, `403`, `404`, `409`, file-provider `501`, and successful publication/install/update.

```ts
expect(await readJson(response)).toEqual({
    code: 404,
    data: null,
    msg: "Application is not installed for this tenant.",
});
```

- [ ] **Step 2: Run route tests and confirm failure**

```powershell
pnpm test -- src/app/api/admin/apps src/app/api/tenant/apps
```

Expected: failure because routes do not exist.

- [ ] **Step 3: Implement platform routes**

- `GET /api/admin/apps`: list registry and publication status.
- `POST /api/admin/apps/[appKey]/versions`: publish the exact reviewed version.

Use `requirePlatformPermission(request, "platform.apps.publish")` for mutation.

- [ ] **Step 4: Implement tenant routes**

- `GET /api/tenant/apps`: list available and installed applications.
- `POST /api/tenant/apps`: install `{ appKey, version }`.
- `PATCH /api/tenant/apps/[appKey]`: enable or disable.
- `PUT /api/tenant/apps/[appKey]/settings`: validate and store settings.
- `PUT /api/tenant/apps/[appKey]/pricing`: store collection mode and sale price.

Use `requireTenantPermission(request, "tenant.apps.read")` for listing and `requireTenantPermission(request, "tenant.apps.configure")` for install/enable/settings/pricing changes. Application execution uses:

```ts
const permission: TenantPermission = `tenant.apps.use.${appKey}`;
await requireTenantPermission(request, permission);
```

- [ ] **Step 5: Run tests**

```powershell
pnpm test -- src/app/api/admin/apps src/app/api/tenant/apps
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/app/api/admin/apps web/src/app/api/tenant/apps
git commit -m "feat: add application administration APIs"
```

---

## Task 5: Build the Application Catalog and Tenant Administration UI

**Files:**

- Create: `web/src/services/api/app-center.ts`
- Create: `web/src/services/api/app-center.test.ts`
- Create: `web/src/app/admin/apps/page.tsx`
- Create: `web/src/app/admin/apps/components/platform-apps-client.tsx`
- Create: `web/src/app/tenant-admin/apps/page.tsx`
- Create: `web/src/app/tenant-admin/apps/components/tenant-apps-client.tsx`
- Create: `web/src/app/(user)/apps/page.tsx`
- Create: `web/src/app/(user)/apps/components/app-catalog-client.tsx`
- Modify: `web/src/app/admin/page.tsx`
- Modify: `web/src/app/tenant-admin/page.tsx`

- [ ] **Step 1: Add API client tests**

Test that the client preserves response codes, tenant context errors, and validation messages.

- [ ] **Step 2: Implement typed clients**

```ts
export async function listTenantApps(): Promise<TenantAppSummary[]> {
    return requestApiData<TenantAppSummary[]>("/api/tenant/apps");
}
```

Reuse the Plan 1 shared parser:

```ts
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
```

- [ ] **Step 3: Build platform publication UI**

Display reviewed definitions, published versions, current version, and a publish command. Do not allow editing executable definition JSON in the browser.

- [ ] **Step 4: Build tenant install/configure UI**

Use tabs for `Installed`, `Available`, and `Pricing`. Use switches for enable/disable, schema-driven controls for settings, and a segmented control for `Platform collection` versus `Tenant merchant`.

- [ ] **Step 5: Build the user catalog**

Only render enabled applications the current member may use. Each item links to `/apps/[appKey]`.

- [ ] **Step 6: Verify rendering**

```powershell
pnpm test -- src/services/api/app-center.test.ts src/services/api/api-envelope.test.ts
pnpm typecheck
pnpm lint
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add web/src/services/api/app-center.ts web/src/services/api/app-center.test.ts web/src/app/admin/apps web/src/app/tenant-admin/apps web/src/app/\(user\)/apps web/src/app/admin/page.tsx web/src/app/tenant-admin/page.tsx
git commit -m "feat: add application center interfaces"
```

---

## Task 6: Add the AI Runtime Adapter and Immutable Task Snapshot

**Files:**

- Create: `web/src/lib/server/apps/app-runtime-types.ts`
- Create: `web/src/lib/server/apps/app-runtime-service.ts`
- Create: `web/src/lib/server/apps/app-runtime-service.test.ts`
- Create: `web/src/lib/server/apps/app-workflow-registry.ts`
- Create: `web/src/lib/server/apps/app-workflow-registry.test.ts`
- Create: `web/src/app/api/apps/[appKey]/runs/route.ts`
- Create: `web/src/app/api/apps/[appKey]/runs/route.test.ts`
- Modify: `web/src/lib/server/generation-task-types.ts`
- Modify: `web/src/lib/server/generation-task-store.ts`
- Modify: `web/src/lib/server/generation-task-store.test.ts`
- Modify: `web/src/lib/server/database/schema.ts`

- [ ] **Step 1: Write submission and snapshot tests**

Cover disabled apps, missing permissions, invalid input, stable configuration resolution, idempotency, and snapshot persistence.

```ts
expect(task.appSnapshot).toMatchObject({
    appKey: "background-removal",
    appVersion: "1.0.0",
    workflowKey: "background-removal.v1",
    collectionMode: "platform",
    salePricing: { currency: "POINT", unit: "task", amount: 10 },
});
```

- [ ] **Step 2: Add runtime contracts**

```ts
export type AppExecutionSnapshot = Readonly<{
    tenantId: string;
    appKey: string;
    appVersion: string;
    workflowKey: string;
    collectionMode: "platform" | "tenant";
    configuration: Record<string, unknown>;
    salePricing: { currency: string; unit: string; amount: number };
    costPricing: { unit: string; estimatedAmount: number };
}>;

export interface AppTaskBillingPort {
    reserve(input: {
        tenantId: string;
        userId: string;
        generationTaskId: string;
        idempotencyKey: string;
        snapshot: AppExecutionSnapshot;
    }): Promise<void>;
}
```

- [ ] **Step 3: Extend Generation Task storage**

Plan 1 already adds the required non-null `tenant_id`. Add `appSnapshot` and `idempotencyKey` to `StoredGenerationTaskRecord`, and add the matching nullable PostgreSQL columns:

```sql
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS app_snapshot_json JSONB;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS generation_tasks_tenant_id_idempotency_key_uidx
ON generation_tasks(tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

Plan 4 verifies the existing default-tenant backfill and completes tenant enforcement for resource roots introduced after Plan 1.

- [ ] **Step 4: Implement workflow and billing ports**

`app-workflow-registry.ts` maps reviewed workflow keys to adapters that return an existing `GenerationTaskType` and task payload. Until Plan 3 replaces it, inject a compatibility billing port that delegates to the existing points reservation once and records no platform-cost ledger.

```ts
export type AppWorkflowAdapter = (input: {
    values: Record<string, unknown>;
    snapshot: AppExecutionSnapshot;
}) => Promise<{ taskType: GenerationTaskType; payload: Record<string, unknown> }>;
```

- [ ] **Step 5: Implement `submitAppRun`**

The service must:

1. Require tenant membership and app-use permission.
2. Load an enabled tenant installation.
3. Validate input and resolve configuration.
4. Build immutable app and price snapshots.
5. Allocate the task ID and create the tenant-scoped task plus billing reservation in one database transaction.
6. Enqueue or expose the task to workers only after that transaction commits.
7. Return the existing task representation.

If reservation fails, roll back task creation. Retries with the same tenant-scoped idempotency key return the previously committed task and reservation.

- [ ] **Step 6: Implement the route**

`POST /api/apps/[appKey]/runs` accepts:

```ts
type CreateAppRunBody = {
    values: Record<string, unknown>;
    idempotencyKey: string;
};
```

Return `201` on first creation and `200` for an idempotent replay.

- [ ] **Step 7: Run tests**

```powershell
pnpm test -- src/lib/server/apps src/lib/server/generation-task-store.test.ts src/app/api/apps
pnpm typecheck
```

Expected: pass.

- [ ] **Step 8: Commit**

```powershell
git add web/src/lib/server/apps web/src/app/api/apps web/src/lib/server/generation-task-types.ts web/src/lib/server/generation-task-store.ts web/src/lib/server/generation-task-store.test.ts web/src/lib/server/database/schema.ts
git commit -m "feat: route application runs through generation tasks"
```

---

## Task 7: Add the Generic Application Run Page

**Files:**

- Create: `web/src/app/(user)/apps/[appKey]/page.tsx`
- Create: `web/src/app/(user)/apps/[appKey]/components/schema-app-runner.tsx`
- Create: `web/src/app/(user)/apps/[appKey]/components/schema-app-runner.test.tsx`
- Create: `web/src/app/(user)/apps/[appKey]/components/app-result-panel.tsx`
- Create: `web/src/services/api/app-runs.ts`
- Create: `web/src/services/api/app-runs.test.ts`

- [ ] **Step 1: Write component and client tests**

Cover required fields, image count, numeric limits, duplicate-submit prevention, task polling, success asset display, and server-side permission errors.

- [ ] **Step 2: Implement schema controls**

Map `text`, `image`, `select`, and `number` fields to stable Ant Design controls. Generate the idempotency key once when the user starts a submission and reuse it for network retries.

- [ ] **Step 3: Implement result rendering**

Use existing task polling and media preview helpers. A custom renderer key is looked up from a static component registry; unknown keys fail closed with `APP_RENDERER_NOT_AVAILABLE`.

- [ ] **Step 4: Run tests**

```powershell
pnpm test -- src/app/\(user\)/apps src/services/api/app-runs.test.ts
pnpm typecheck
pnpm lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/app/\(user\)/apps/\[appKey\] web/src/services/api/app-runs.ts web/src/services/api/app-runs.test.ts
git commit -m "feat: add generic application runner"
```

---

## Task 8: Verify Application Platform Boundaries

**Files:**

- Create: `web/e2e/application-center.spec.ts`
- Modify: `web/README.md`
- Modify: `.env.example`

- [ ] **Step 1: Add E2E coverage**

Seed platform admin, tenant owner, ordinary member, two tenants, and one published app through test helpers. Verify:

- Platform admin publishes `background-removal@1.0.0`.
- Tenant A installs, configures, prices, and enables it.
- Tenant B cannot read Tenant A settings.
- An authorized member submits one idempotent run.
- An unauthorized member receives `403`.
- File-provider mode receives `501` on SaaS administration routes.

- [ ] **Step 2: Document flags**

Add:

```dotenv
VOZEB_PRO_SAAS_ENABLED=false
VOZEB_PRO_APP_CENTER_ENABLED=false
```

Document that PostgreSQL is required and the app-center flag may only be enabled after the default-tenant backfill.

- [ ] **Step 3: Run phase verification**

```powershell
pnpm test -- src/lib/apps src/lib/server/apps src/app/api/admin/apps src/app/api/tenant/apps src/app/api/apps
pnpm e2e -- application-center.spec.ts
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits with code `0`.

- [ ] **Step 4: Commit**

```powershell
git add web/e2e/application-center.spec.ts web/README.md .env.example
git commit -m "test: verify application center boundaries"
```

## Exit Criteria

- Reviewed application definitions can be published without accepting executable tenant code.
- Tenants can install, enable, configure, authorize, and price an application.
- Application settings and installations cannot cross tenant boundaries.
- Every app submission produces an idempotent tenant-scoped Generation Task with immutable execution and price snapshots.
- Existing non-application generation routes continue to pass their regression tests.
