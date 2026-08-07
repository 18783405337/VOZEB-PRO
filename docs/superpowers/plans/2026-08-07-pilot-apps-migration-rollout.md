# Pilot Apps, Migration, and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver background removal, product image, and product promo video through the new VOZEB application runtime, migrate approved DQAIGC configuration into PostgreSQL, backfill existing VOZEB data into the default tenant, and release through controlled feature flags.

**Architecture:** The three pilots reuse VOZEB image, video, model routing, task worker, asset, and billing services. App-specific catalog data uses one tenant-scoped content table. DQAIGC is accessed read-only and exported into a versioned normalized JSON contract; a separate idempotent importer validates, dry-runs, and writes through VOZEB repositories. Cutover is flag-driven and reversible without reverting schema.

**Tech Stack:** TypeScript 5, Next.js, PostgreSQL, existing Generation Worker and media services, Node.js migration scripts, `mysql2` read-only export client, Vitest, Playwright.

## Global Constraints

- Complete Plans 1-3 before production migration.
- Treat `D:\homeWork\曼居code\aigc-code` as a read-only source during migration development.
- Never connect the migration exporter with a MySQL account that has write privileges.
- Do not import DQAIGC plaintext payment/provider secrets.
- Do not import all historical generation process logs in the MVP.
- Reuse VOZEB assets when source URLs are reachable; copy approved remote assets through the object-storage ingestion path.
- Existing VOZEB records must be reconciled into the fixed `default` tenant before tenant enforcement becomes non-null.
- Every migration command supports `--dry-run`, emits counts and checksums, and is idempotent.
- Pilot application pricing is snapshotted at task submission and settled by Plan 3.
- Release one named tenant first; keep existing VOZEB routes available during the pilot.
- Implement with TDD and commit after every task.

## DQAIGC Read-Only Sources

Background removal:

- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_background_removal\manifest.json`
- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_background_removal\api_schema.json`
- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_background_removal\migrations\install.sql`
- `D:\homeWork\曼居code\aigc-code\app\common\service\app\aigc_background_removal\AigcBackgroundRemovalService.php`

Product image:

- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_product_image\manifest.json`
- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_product_image\api_schema.json`
- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_product_image\migrations\install.sql`
- `D:\homeWork\曼居code\aigc-code\app\common\service\app\aigc_product_image\AigcProductImageService.php`

Product promo video:

- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_product_promo_video\manifest.json`
- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_product_promo_video\api_schema.json`
- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_product_promo_video\migrations\install.sql`
- `D:\homeWork\曼居code\aigc-code\app\common\service\app\aigc_product_promo_video\AigcProductPromoVideoService.php`

---

## Task 1: Add Tenant Application Content Storage

**Files:**

- Create: `web/src/lib/server/database/schema-app-content.ts`
- Modify: `web/src/lib/server/database/schema.ts`
- Modify: `web/src/lib/server/database/postgres.ts`
- Modify: `web/src/lib/server/database/postgres.test.ts`
- Create: `web/src/lib/server/database/app-content-repository.ts`
- Create: `web/src/lib/server/database/app-content-repository.test.ts`
- Modify: `web/src/lib/server/database/repositories.ts`

- [ ] **Step 1: Write failing schema and isolation tests**

Test table registration, tenant-scoped unique codes, soft deletion, ordering, and cross-tenant lookup denial.

- [ ] **Step 2: Add one generic content table**

```sql
CREATE TABLE IF NOT EXISTS tenant_app_content_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    tenant_app_id TEXT NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
    content_kind TEXT NOT NULL,
    item_code TEXT NOT NULL,
    parent_code TEXT,
    name TEXT NOT NULL,
    data_json JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('enabled', 'disabled')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    deleted_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (tenant_id, tenant_app_id, content_kind, item_code)
);
```

Register the table and update the expected table count from `77` to `78`.

- [ ] **Step 3: Implement the repository**

```ts
export interface AppContentRepository {
    list(tenantId: string, tenantAppId: string, kind: string, enabledOnly?: boolean): Promise<AppContentItem[]>;
    get(tenantId: string, tenantAppId: string, kind: string, code: string): Promise<AppContentItem | null>;
    upsert(tenantId: string, input: SaveAppContentItemInput): Promise<AppContentItem>;
    setStatus(tenantId: string, id: string, status: "enabled" | "disabled"): Promise<void>;
    softDelete(tenantId: string, id: string): Promise<void>;
}
```

Every SQL method must include `tenant_id`.

- [ ] **Step 4: Run tests and commit**

```powershell
cd D:\homeWork\saas-api\VOZEB-PRO\web
pnpm test -- src/lib/server/database/postgres.test.ts src/lib/server/database/app-content-repository.test.ts
git add web/src/lib/server/database/schema-app-content.ts web/src/lib/server/database/schema.ts web/src/lib/server/database/postgres.ts web/src/lib/server/database/postgres.test.ts web/src/lib/server/database/app-content-repository.ts web/src/lib/server/database/app-content-repository.test.ts web/src/lib/server/database/repositories.ts
git commit -m "feat: add tenant application content storage"
```

Expected: tests pass and commit succeeds.

---

## Task 2: Implement Background Removal

**Files:**

- Modify: `web/src/lib/apps/definitions/background-removal.ts`
- Create: `web/src/lib/server/apps/workflows/background-removal-workflow.ts`
- Create: `web/src/lib/server/apps/workflows/background-removal-workflow.test.ts`
- Create: `web/src/lib/server/apps/workflows/png-alpha-validator.ts`
- Create: `web/src/lib/server/apps/workflows/png-alpha-validator.test.ts`
- Modify: `web/src/lib/server/apps/app-workflow-registry.ts`
- Create: `web/src/app/(user)/apps/[appKey]/components/background-removal-result.tsx`
- Modify: `web/src/app/(user)/apps/[appKey]/components/app-result-panel.tsx`

- [ ] **Step 1: Write workflow behavior tests**

Cover required source image, output size/quality selection, prompt composition, tenant model-channel override, fixed per-task price, transparent PNG success, non-transparent result failure, and retry using the original task snapshot.

- [ ] **Step 2: Finalize the definition**

Use input fields:

```ts
[
    { key: "sourceImage", kind: "image", label: "Source image", required: true, maxItems: 1 },
    { key: "quality", kind: "select", label: "Quality", required: true, options: ["standard", "high"] },
]
```

Use `billingMetric: "task"` and custom renderer key `background-removal-result`.

- [ ] **Step 3: Map to the existing image runtime**

The workflow builds an image-edit payload that preserves subject geometry and requests transparent PNG output. It resolves the logical model through existing VOZEB model routing and returns `taskType: "image"`.

```ts
return {
    taskType: "image",
    payload: {
        prompt: buildBackgroundRemovalPrompt(input.snapshot.configuration),
        referenceImages: [sourceImage],
        outputFormat: "png",
        transparentBackground: true,
        quality,
    },
};
```

- [ ] **Step 4: Validate output before success**

Inspect the stored PNG result and confirm an alpha channel exists. If the provider returns an opaque image, mark the workflow result `error` with `BACKGROUND_NOT_TRANSPARENT`; release or settle according to the configured provider-cost policy captured in the task snapshot.

- [ ] **Step 5: Register renderer and run tests**

```powershell
pnpm test -- src/lib/server/apps/workflows/background-removal-workflow.test.ts src/lib/server/apps/workflows/png-alpha-validator.test.ts
pnpm typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/apps/definitions/background-removal.ts web/src/lib/server/apps/workflows/background-removal-workflow.ts web/src/lib/server/apps/workflows/background-removal-workflow.test.ts web/src/lib/server/apps/workflows/png-alpha-validator.ts web/src/lib/server/apps/workflows/png-alpha-validator.test.ts web/src/lib/server/apps/app-workflow-registry.ts web/src/app/\(user\)/apps/\[appKey\]/components/background-removal-result.tsx web/src/app/\(user\)/apps/\[appKey\]/components/app-result-panel.tsx
git commit -m "feat: add background removal application"
```

---

## Task 3: Implement Product Image Catalog and Workflow

**Files:**

- Modify: `web/src/lib/apps/definitions/product-image.ts`
- Create: `web/src/lib/server/apps/product-image/product-image-service.ts`
- Create: `web/src/lib/server/apps/product-image/product-image-service.test.ts`
- Create: `web/src/lib/server/apps/workflows/product-image-workflow.ts`
- Create: `web/src/lib/server/apps/workflows/product-image-workflow.test.ts`
- Create: `web/src/app/api/tenant/apps/product-image/categories/route.ts`
- Create: `web/src/app/api/tenant/apps/product-image/templates/route.ts`
- Create: `web/src/app/api/tenant/apps/product-image/templates/[id]/route.ts`
- Create: `web/src/app/api/tenant/apps/product-image/catalog-routes.test.ts`
- Modify: `web/src/lib/server/apps/app-workflow-registry.ts`
- Create: `web/src/app/tenant-admin/apps/product-image/page.tsx`
- Create: `web/src/app/(user)/apps/[appKey]/components/product-image-runner.tsx`

- [ ] **Step 1: Write category and template tests**

Port these DQAIGC rules:

- Category code is unique per tenant application.
- A category with templates cannot be deleted.
- Templates reference a category from the same tenant.
- Disabled categories/templates do not appear to end users.
- Template deletion is soft.
- A task stores template name, prompt, and image snapshots.

- [ ] **Step 2: Define content kinds**

Use:

```ts
const PRODUCT_IMAGE_CONTENT = {
    category: "product-image.category",
    template: "product-image.template",
} as const;
```

Store template-specific data in `data_json`:

```ts
type ProductImageTemplateData = {
    imageAssetId: string;
    prompt: string;
    vipRequired: boolean;
};
```

- [ ] **Step 3: Implement tenant administration APIs**

Require `tenant.apps.configure`. Validate all category/template references through `AppContentRepository`; never accept a raw tenant ID.

- [ ] **Step 4: Implement workflow modes**

Support:

- `template`: product image plus selected template image/prompt.
- `custom`: product image plus custom scene image and user prompt.

Build the final prompt from the published template, selected content snapshot, configured negative prompt, dimensions, and user input. Submit through the existing image Generation Task adapter.

- [ ] **Step 5: Implement custom UI**

The user page shows category tabs, template thumbnails, product upload, optional custom scene upload, output size, and generated assets. The tenant page manages categories and templates without exposing prompt secrets designated as server-only.

- [ ] **Step 6: Run tests and commit**

```powershell
pnpm test -- src/lib/server/apps/product-image src/lib/server/apps/workflows/product-image-workflow.test.ts src/app/api/tenant/apps/product-image
pnpm typecheck
pnpm lint
git add web/src/lib/apps/definitions/product-image.ts web/src/lib/server/apps/product-image web/src/lib/server/apps/workflows/product-image-workflow.ts web/src/lib/server/apps/workflows/product-image-workflow.test.ts web/src/app/api/tenant/apps/product-image web/src/lib/server/apps/app-workflow-registry.ts web/src/app/tenant-admin/apps/product-image web/src/app/\(user\)/apps/\[appKey\]/components/product-image-runner.tsx
git commit -m "feat: add product image application"
```

Expected: tests, typecheck, and lint pass.

---

## Task 4: Implement Product Promo Video as a Multi-Step Workflow

**Files:**

- Modify: `web/src/lib/apps/definitions/product-promo-video.ts`
- Create: `web/src/lib/server/apps/product-promo-video/product-promo-video-service.ts`
- Create: `web/src/lib/server/apps/product-promo-video/product-promo-video-service.test.ts`
- Create: `web/src/lib/server/apps/workflows/product-promo-video-workflow.ts`
- Create: `web/src/lib/server/apps/workflows/product-promo-video-workflow.test.ts`
- Create: `web/src/lib/server/apps/workflow-runner.ts`
- Create: `web/src/lib/server/apps/workflow-runner.test.ts`
- Create: `web/src/app/api/tenant/apps/product-promo-video/types/route.ts`
- Create: `web/src/app/api/tenant/apps/product-promo-video/types/[id]/route.ts`
- Create: `web/src/app/api/apps/product-promo-video/prompt/route.ts`
- Modify: `web/src/lib/server/apps/app-workflow-registry.ts`
- Create: `web/src/app/tenant-admin/apps/product-promo-video/page.tsx`
- Create: `web/src/app/(user)/apps/[appKey]/components/product-promo-video-runner.tsx`

- [ ] **Step 1: Write type and workflow tests**

Port these DQAIGC rules:

- Default video types are seeded idempotently.
- Built-in types cannot be deleted but may be disabled.
- Custom type codes are unique per tenant application.
- Duration and ratio must match an available video model specification.
- Sale price is computed from the captured per-second or SKU rule.
- Prompt enhancement failure can fall back to the original user prompt only when the user selected `allowPromptFallback`.
- Video failure settles only completed billable steps and releases the remaining reservation.

- [ ] **Step 2: Implement workflow-run state**

Use a parent `render` Generation Task and child tasks linked by `parentTaskId`:

```ts
type ProductPromoWorkflowState = {
    promptStep: "skipped" | "pending" | "success" | "error";
    videoStep: "pending" | "running" | "success" | "error";
    completedBillableSteps: Array<"prompt" | "video">;
};
```

The parent snapshot contains source image, type snapshot, ratio, duration, model channel, prompt policy, sale price, and cost rules.

- [ ] **Step 3: Implement optional prompt writing/optimization**

Route through VOZEB's existing text/LLM model path. The endpoint accepts either a short hint to write a prompt or an existing prompt to optimize; it never calls a provider directly.

- [ ] **Step 4: Submit the video child task**

Use the source image as a reference asset, the selected type prompt, final prompt, ratio, duration, quality, and resolved logical video model. Task completion updates the parent workflow and invokes Plan 3 billing with completed billable steps.

- [ ] **Step 5: Implement type administration and user UI**

Tenant admins manage type name, description, prompt, cover asset, status, and ordering. The user runner provides image upload, video type, ratio, duration, prompt helper, estimate, submit, progress, and final video/cover display.

- [ ] **Step 6: Run tests and commit**

```powershell
pnpm test -- src/lib/server/apps/product-promo-video src/lib/server/apps/workflow-runner.test.ts src/lib/server/apps/workflows/product-promo-video-workflow.test.ts src/app/api/tenant/apps/product-promo-video src/app/api/apps/product-promo-video
pnpm typecheck
pnpm lint
git add web/src/lib/apps/definitions/product-promo-video.ts web/src/lib/server/apps/product-promo-video web/src/lib/server/apps/workflows/product-promo-video-workflow.ts web/src/lib/server/apps/workflows/product-promo-video-workflow.test.ts web/src/lib/server/apps/workflow-runner.ts web/src/lib/server/apps/workflow-runner.test.ts web/src/app/api/tenant/apps/product-promo-video web/src/app/api/apps/product-promo-video web/src/lib/server/apps/app-workflow-registry.ts web/src/app/tenant-admin/apps/product-promo-video web/src/app/\(user\)/apps/\[appKey\]/components/product-promo-video-runner.tsx
git commit -m "feat: add product promo video workflow"
```

Expected: tests, typecheck, and lint pass.

---

## Task 5: Define the DQAIGC Normalized Export Contract

**Files:**

- Create: `web/src/lib/server/migration/dqaigc-contract.ts`
- Create: `web/src/lib/server/migration/dqaigc-contract.test.ts`
- Create: `web/scripts/dqaigc-export.mjs`
- Create: `web/scripts/lib/dqaigc-export-core.mjs`
- Create: `web/scripts/lib/dqaigc-export-core.test.ts`
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`
- Modify: `.env.example`

- [ ] **Step 1: Add `mysql2` non-interactively**

```powershell
cd D:\homeWork\saas-api\VOZEB-PRO\web
pnpm add mysql2
```

Expected: `package.json` and `pnpm-lock.yaml` update without interactive prompts.

- [ ] **Step 2: Write contract validation tests**

```ts
export type DqaigcNormalizedExport = {
    format: "vozeb-dqaigc-export";
    version: 1;
    exportedAt: string;
    source: { database: string; readOnly: true };
    tenants: DqaigcTenantExport[];
};

export type DqaigcTenantExport = {
    sourceTenantId: string;
    slug: string;
    name: string;
    domains: string[];
    members: Array<{ sourceUserId: string; email?: string; mobile?: string; roleKeys: string[] }>;
    apps: Array<{
        appKey: "background-removal" | "product-image" | "product-promo-video";
        sourceAppCode: string;
        version: string;
        enabled: boolean;
        settings: Record<string, unknown>;
        pricing: Record<string, unknown>;
        contentItems: NormalizedAppContentItem[];
    }>;
    openingBalances: {
        userWallets: NormalizedOpeningBalance[];
        tenantPower: NormalizedOpeningBalance[];
    };
};
```

Reject unknown format versions, duplicate source IDs, negative balances, unrecognized pilot app codes, and plaintext credential fields.

- [ ] **Step 3: Implement the read-only exporter**

Require:

```dotenv
DQAIGC_MYSQL_URL=
DQAIGC_EXPORT_PATH=
```

On startup execute `SHOW GRANTS FOR CURRENT_USER`, reject credentials with `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `TRIGGER`, or `GRANT OPTION`, and then start a read-only consistent-snapshot transaction. Query only the three pilot app tables plus tenant/domain/member/app installation and approved opening-balance sources. Map:

- `aigc_background_removal` -> `background-removal`
- `aigc_product_image` -> `product-image`
- `aigc_product_promo_video` -> `product-promo-video`

Do not export merchant secrets, provider keys, task payloads, or raw payment credentials.

- [ ] **Step 4: Add the package command**

```json
"migrate:dqaigc:export": "node --env-file-if-exists=.env.local scripts/dqaigc-export.mjs"
```

The command requires `--dry-run` or `--write`; default invocation exits with usage code `2`.

- [ ] **Step 5: Run tests and a dry run**

```powershell
pnpm test -- src/lib/server/migration/dqaigc-contract.test.ts scripts/lib/dqaigc-export-core.test.ts
pnpm migrate:dqaigc:export -- --dry-run
```

Expected: tests pass; dry run prints table counts and a SHA-256 checksum without writing a file.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/migration/dqaigc-contract.ts web/src/lib/server/migration/dqaigc-contract.test.ts web/scripts/dqaigc-export.mjs web/scripts/lib/dqaigc-export-core.mjs web/scripts/lib/dqaigc-export-core.test.ts web/package.json web/pnpm-lock.yaml .env.example
git commit -m "feat: add read only dqaigc exporter"
```

---

## Task 6: Build the Idempotent DQAIGC Importer

**Files:**

- Create: `web/scripts/dqaigc-import.mjs`
- Create: `web/scripts/lib/dqaigc-import-core.mjs`
- Create: `web/scripts/lib/dqaigc-import-core.test.ts`
- Create: `web/src/lib/server/database/migration-run-repository.ts`
- Create: `web/src/lib/server/database/migration-run-repository.test.ts`
- Create: `web/src/lib/server/database/schema-migration-runs.ts`
- Create: `web/src/lib/server/database/schema-migration-runs.test.ts`
- Modify: `web/src/lib/server/database/schema.ts`
- Modify: `web/src/lib/server/database/postgres.ts`
- Modify: `web/src/lib/server/database/postgres.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Add migration run schema and tests**

```sql
CREATE TABLE IF NOT EXISTS migration_runs (
    id TEXT PRIMARY KEY,
    migration_key TEXT NOT NULL,
    source_checksum TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('dry_run', 'running', 'completed', 'failed')),
    report_json JSONB NOT NULL,
    started_at BIGINT NOT NULL,
    completed_at BIGINT,
    UNIQUE (migration_key, source_checksum)
);
```

Register the table and update the expected table count from `78` to `79`.

- [ ] **Step 2: Write importer tests**

Cover dry-run no writes, checksum replay, tenant slug collision, domain collision, user match by verified email/mobile, unresolved-member report, app install/config/content import, opening balance ledger entries, and transaction rollback.

- [ ] **Step 3: Implement validation and planning**

The importer produces:

```ts
type ImportReport = {
    checksum: string;
    creates: Record<string, number>;
    updates: Record<string, number>;
    skips: Record<string, number>;
    conflicts: Array<{ code: string; sourceId: string; message: string }>;
    unresolvedMembers: Array<{ sourceTenantId: string; sourceUserId: string }>;
};
```

`--dry-run` validates all references and returns this report without opening a write transaction.

- [ ] **Step 4: Implement transactional write mode**

`--write` requires `--confirm-checksum <sha256>`. Use VOZEB repositories to create tenants, domains, memberships, app installations, settings, pricing, content items, and opening balance ledger entries. Store source IDs in migration metadata for replay detection.

- [ ] **Step 5: Add the package command and run tests**

```json
"migrate:dqaigc:import": "node --env-file-if-exists=.env.local scripts/dqaigc-import.mjs"
```

```powershell
pnpm test -- scripts/lib/dqaigc-import-core.test.ts src/lib/server/database/migration-run-repository.test.ts src/lib/server/database/postgres.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add web/scripts/dqaigc-import.mjs web/scripts/lib/dqaigc-import-core.mjs web/scripts/lib/dqaigc-import-core.test.ts web/src/lib/server/database/migration-run-repository.ts web/src/lib/server/database/migration-run-repository.test.ts web/src/lib/server/database/schema-migration-runs.ts web/src/lib/server/database/schema-migration-runs.test.ts web/src/lib/server/database/schema.ts web/src/lib/server/database/postgres.ts web/src/lib/server/database/postgres.test.ts web/package.json
git commit -m "feat: add idempotent dqaigc importer"
```

---

## Task 7: Complete and Verify the Existing VOZEB Default-Tenant Backfill

**Files:**

- Modify: `web/scripts/saas-default-tenant-backfill.mjs`
- Modify: `web/scripts/lib/saas-default-tenant-backfill-core.mjs`
- Modify: `web/scripts/lib/saas-default-tenant-backfill-core.test.ts`
- Create: `web/scripts/saas-tenant-integrity-check.mjs`
- Modify: `web/src/lib/server/database/schema.ts`
- Modify: `web/package.json`
- Modify: `web/README.md`

- [ ] **Step 1: Write backfill planning tests**

Cover an empty database, existing default tenant, mixed null/non-null tenant IDs, orphan child rows, cross-tenant parent/child mismatch, and rerun idempotency.

- [ ] **Step 2: Implement nullable-column backfill**

Create or find tenant:

```ts
const DEFAULT_TENANT = {
    id: "default",
    slug: "default",
    name: "Default Tenant",
};
```

Plan 1 already provides the controlled script and enforces the original generation, conversation, asset, canvas, drama, publication, and billing-order roots after its write-mode run. Extend that script to verify those roots, then fill nullable `tenant_id` values only for resource roots introduced later, including payments/refunds, wallets, task-billing reservations, settlement records, merchant-aware commercial records, and application content. Process parent tables before children and leave non-null tenant IDs unchanged.

- [ ] **Step 3: Add integrity checks**

The checker reports:

- Null `tenant_id` counts by table.
- Orphan foreign keys.
- Parent/child tenant mismatches.
- Duplicate tenant-scoped idempotency keys.
- Ledger/account balance mismatches.
- Orders whose merchant owner conflicts with collection mode.

Exit code is `1` when any blocking count is non-zero.

- [ ] **Step 4: Enforce final constraints**

Only after the integrity check passes, update schema DDL to set required root `tenant_id` columns `NOT NULL`, add composite indexes, and add collection-mode checks. Preserve global tables such as users and platform settings without tenant columns.

- [ ] **Step 5: Add commands**

```json
"check:saas:integrity": "node --env-file-if-exists=.env.local scripts/saas-tenant-integrity-check.mjs"
```

The existing backfill command still defaults to dry-run. Write mode requires `--write --confirm-database <database-name>`; the integrity command is read-only.

- [ ] **Step 6: Run tests and commit**

```powershell
pnpm test -- scripts/lib/saas-default-tenant-backfill-core.test.ts src/lib/server/database
pnpm typecheck
git add web/scripts/saas-default-tenant-backfill.mjs web/scripts/lib/saas-default-tenant-backfill-core.mjs web/scripts/lib/saas-default-tenant-backfill-core.test.ts web/scripts/saas-tenant-integrity-check.mjs web/src/lib/server/database/schema.ts web/package.json web/README.md
git commit -m "feat: complete SaaS tenant backfill enforcement"
```

Expected: tests and typecheck pass.

---

## Task 8: Add Audit, Metrics, and Operational Controls

**Files:**

- Modify: `web/src/lib/server/audit-log-store.ts`
- Create: `web/src/lib/server/saas/saas-audit-events.ts`
- Create: `web/src/lib/server/saas/saas-audit-events.test.ts`
- Create: `web/src/app/api/admin/saas/health/route.ts`
- Create: `web/src/app/api/admin/saas/health/route.test.ts`
- Modify: `web/src/app/admin/generation-operations/components/generation-operations-client.tsx`
- Modify: `web/scripts/release-check.mjs`

- [ ] **Step 1: Define structured audit events**

Include tenant ID, actor ID, target type/ID, action, result, request ID, and redacted metadata for:

- Tenant create/disable.
- Member/role changes.
- App publish/install/enable/configure/price.
- Merchant configuration changes.
- Task billing reserve/settle/release/reverse.
- Migration dry run/write.

- [ ] **Step 2: Add SaaS health checks**

Return platform-admin-only aggregate status for:

- Tenant integrity.
- Pending/failed billing settlement hooks.
- Ledger projection mismatches.
- Unknown merchant webhook attempts.
- Migration run status.
- Enabled apps with missing workflow/model dependencies.

- [ ] **Step 3: Extend generation operations**

Add tenant, app, workflow, billing status, sale amount, and platform cost filters/columns. Keep secret snapshots and raw provider credentials hidden.

- [ ] **Step 4: Add release checks**

`scripts/release-check.mjs` must fail when SaaS flags are enabled but:

- Database provider is not PostgreSQL.
- Default tenant is missing.
- Integrity check fails.
- Payment master key is missing while merchant accounts exist.
- Published app definitions lack registered workflows.

- [ ] **Step 5: Run tests and commit**

```powershell
pnpm test -- src/lib/server/saas/saas-audit-events.test.ts src/app/api/admin/saas/health
pnpm check:release
git add web/src/lib/server/audit-log-store.ts web/src/lib/server/saas web/src/app/api/admin/saas/health web/src/app/admin/generation-operations/components/generation-operations-client.tsx web/scripts/release-check.mjs
git commit -m "feat: add saas operational controls"
```

Expected: tests and release checks pass in a correctly configured test environment.

---

## Task 9: Rehearse Migration and Release the MVP

**Files:**

- Create: `web/e2e/saas-pilot-apps.spec.ts`
- Create: `docs/runbooks/saas-migration-runbook.md`
- Create: `docs/runbooks/saas-rollback-runbook.md`
- Modify: `.env.example`
- Modify: `web/README.md`

- [ ] **Step 1: Add full pilot E2E coverage**

Test one platform admin, two tenants, tenant owners, and members:

- Publish and install all three pilot applications.
- Configure different model channels and prices for each tenant.
- Complete background removal and verify transparent output.
- Complete template and custom-scene product images.
- Complete product promo video with prompt enhancement.
- Exercise a partial workflow failure and verify partial settlement.
- Verify all assets, tasks, ledgers, orders, and templates stay tenant-scoped.

- [ ] **Step 2: Write the migration runbook**

The runbook uses exact commands in this order:

```powershell
pnpm backup:disaster
pnpm migrate:saas:backfill -- --dry-run
pnpm migrate:dqaigc:export -- --dry-run
pnpm migrate:dqaigc:import -- --input <normalized-export.json> --dry-run
pnpm check:saas:integrity
pnpm migrate:saas:backfill -- --write --confirm-database <database-name>
pnpm migrate:dqaigc:import -- --input <normalized-export.json> --write --confirm-checksum <sha256>
pnpm check:saas:integrity
pnpm check:release
```

Include row-count reconciliation, checksum recording, unresolved-member review, merchant secret re-entry, and named-tenant smoke tests.

- [ ] **Step 3: Write the rollback runbook**

Rollback disables:

```dotenv
VOZEB_PRO_SAAS_ENABLED=false
VOZEB_PRO_APP_CENTER_ENABLED=false
VOZEB_PRO_SAAS_BILLING_ENABLED=false
```

It routes existing users to the default tenant and existing VOZEB surfaces. It does not delete migrated rows or reverse valid ledger entries. Restore from disaster backup only when data corruption is confirmed and after taking a forensic backup.

- [ ] **Step 4: Perform a staging rehearsal**

Use a production-sized sanitized snapshot. Record:

- Export/import duration.
- Row counts and checksums.
- Integrity-check output.
- Failed/unresolved mappings.
- Worker queue drain time.
- Webhook and payment smoke-test results.
- Rollback duration.

Repeat until the entire runbook completes without manual SQL edits.

- [ ] **Step 5: Run final verification**

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm e2e
pnpm build
pnpm check:saas:integrity
pnpm check:release
```

Expected: every command exits with code `0`.

- [ ] **Step 6: Commit**

```powershell
git add web/e2e/saas-pilot-apps.spec.ts docs/runbooks/saas-migration-runbook.md docs/runbooks/saas-rollback-runbook.md .env.example web/README.md
git commit -m "docs: add saas migration and release runbooks"
```

## Exit Criteria

- All three pilot applications run through VOZEB tasks, assets, model routing, and double-sided billing.
- Product image templates and product promo video types are tenant-owned and isolated.
- DQAIGC approved tenant/app configuration imports through a versioned, dry-run-capable, idempotent contract.
- Existing VOZEB data belongs to the default tenant and all integrity checks pass.
- One named tenant completes staging rehearsal, payment smoke tests, rollback rehearsal, and production canary.
- The legacy DQAIGC system is no longer required for new writes after cutover.
