# Specialized Provider Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add platform-managed specialized provider channels, one logical API subscription per tenant application, and production provider execution for digital human, `image_human`, and action transfer while preserving the source project's provider protocol and task semantics.

**Architecture:** Physical provider credentials remain in existing encrypted system channels. Existing logical models gain reviewed application scopes. A new tenant application provider binding stores one logical model selection per installed app. Specialized business tables keep application-specific state, while a same-ID `generation_tasks` row supplies worker leasing, recovery, billing foreign keys, and operations visibility. VOZEB-PRO calls providers directly through application-specific adapters.

**Tech Stack:** Next.js 16.2.12 Route Handlers and Server Components, TypeScript 5, PostgreSQL, Vitest, Ant Design 6, existing VOZEB-PRO generation worker and task billing services.

## Global Constraints

- VOZEB-PRO is the runtime owner; `aigc-code` is a read-only protocol and behavior reference.
- Preserve source provider paths, methods, request keys, idempotency fields, status parsing, and result extraction unless a verified provider response requires a compatibility addition.
- Digital human uses protocol-specific adapters. Preserve the source Xhadmin TTS/Lipsync flow and add a separate Kling Avatar adapter based on the official Avatar API; never mix request fields between those protocols.
- Never return physical channel IDs, Base URLs, API keys, Authorization headers, or unfiltered provider payloads to tenant clients.
- A tenant application has zero or one logical provider binding. Enabled production execution requires exactly one valid binding.
- A logical model may serve multiple physical channels but must explicitly declare which specialized applications may subscribe to it.
- A provider channel may be retried only before an upstream task ID is accepted. Once submitted, the task remains pinned to that channel.
- Specialized business task IDs and `generation_tasks.id` must be identical.
- Implement every production behavior with TDD: add the focused failing test, run it and observe failure, then add the minimum implementation.
- Commit after every task. Do not include unrelated pre-existing worktree changes in task commits.

---

## Task 1: Add Specialized Application Scopes to Logical Models

**Files:**

- Modify: `web/src/lib/auth/store-types.ts`
- Modify: `web/src/lib/auth/store-normalizers.ts`
- Modify: `web/src/lib/model-routing-config.ts`
- Modify: `web/src/lib/auth/store-normalizers.test.ts`
- Modify: `web/src/lib/model-routing-config.test.ts`
- Modify: `web/src/app/api/admin/settings/route.test.ts`

- [ ] **Step 1: Add failing normalization tests**

Cover:

- `LogicalModel.appKeys` accepts only known reviewed specialized app keys.
- Duplicate and blank app keys are removed.
- Saving and loading admin settings preserves `appKeys`.
- Synchronizing logical models with channel catalogs preserves manually assigned `appKeys`.

Use these reviewed keys:

```ts
export const SPECIALIZED_PROVIDER_APP_KEYS = [
    "aigc-digital-human",
    "image-human",
    "action-transfer",
] as const;
```

- [ ] **Step 2: Run focused tests and confirm failure**

```powershell
cd D:\homeWork\saas-api\VOZEB-PRO\.worktrees\saas-foundation\web
pnpm test -- src/lib/auth/store-normalizers.test.ts src/lib/model-routing-config.test.ts src/app/api/admin/settings/route.test.ts
```

Expected: assertions fail because logical models do not retain application scopes.

- [ ] **Step 3: Add the reviewed application scope types**

Add:

```ts
export type SpecializedProviderAppKey = "aigc-digital-human" | "image-human" | "action-transfer";
```

Extend `LogicalModel` with:

```ts
appKeys?: SpecializedProviderAppKey[];
```

Do not extend `LogicalModelCapability`; all three applications produce video and continue using the existing `video` routing capability.

- [ ] **Step 4: Normalize and validate scopes**

Ensure admin settings normalization:

- keeps only reviewed keys;
- preserves scopes during channel synchronization;
- rejects an app-scoped logical model without an enabled binding;
- does not make specialized models a default generic video model automatically.

- [ ] **Step 5: Re-run focused tests**

```powershell
pnpm test -- src/lib/auth/store-normalizers.test.ts src/lib/model-routing-config.test.ts src/app/api/admin/settings/route.test.ts
```

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/auth/store-types.ts web/src/lib/auth/store-normalizers.ts web/src/lib/model-routing-config.ts web/src/lib/auth/store-normalizers.test.ts web/src/lib/model-routing-config.test.ts web/src/app/api/admin/settings/route.test.ts
git commit -m "feat: scope logical models to specialized apps"
```

---

## Task 2: Add Tenant Application Provider Binding Storage

**Files:**

- Modify: `web/src/lib/server/database/schema-application-center.ts`
- Modify: `web/src/lib/server/database/app-center-repository.ts`
- Modify: `web/src/lib/server/database/app-center-repository.test.ts`
- Modify: `web/src/lib/server/database/postgres.test.ts`
- Modify: `web/src/lib/server/database/postgres.ts`

- [ ] **Step 1: Add failing schema and repository tests**

Assert:

- `tenant_app_provider_bindings` is included in `POSTGRES_TABLES`.
- one row can be inserted for an installed tenant app;
- saving a second logical model replaces the same tenant app binding rather than adding another active binding;
- another tenant cannot read or update the binding;
- deleting a tenant app cascades the binding.

- [ ] **Step 2: Run focused tests and confirm failure**

```powershell
pnpm test -- src/lib/server/database/app-center-repository.test.ts src/lib/server/database/postgres.test.ts
```

- [ ] **Step 3: Add additive PostgreSQL DDL**

Create:

```sql
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
```

Add an index on `(logical_model_key, status, updated_at DESC)`.

- [ ] **Step 4: Add repository ports and mappings**

Add:

- `getProviderBinding(tenantId, appKey)`
- `saveProviderBinding(tenantId, appKey, input)`
- `clearProviderBinding(tenantId, appKey)`

All SQL must join through `tenant_apps.tenant_id`.

- [ ] **Step 5: Re-run focused tests**

```powershell
pnpm test -- src/lib/server/database/app-center-repository.test.ts src/lib/server/database/postgres.test.ts
```

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/database/schema-application-center.ts web/src/lib/server/database/app-center-repository.ts web/src/lib/server/database/app-center-repository.test.ts web/src/lib/server/database/postgres.test.ts web/src/lib/server/database/postgres.ts
git commit -m "feat: store tenant app provider bindings"
```

---

## Task 3: Add Provider Binding Service and Tenant API

**Files:**

- Create: `web/src/lib/server/apps/specialized-provider-binding-service.ts`
- Create: `web/src/lib/server/apps/specialized-provider-binding-service.test.ts`
- Create: `web/src/app/api/tenant/apps/[appKey]/provider-binding/route.ts`
- Create: `web/src/app/api/tenant/apps/[appKey]/provider-binding/route.test.ts`
- Modify: `web/src/lib/server/apps/app-center-service.ts`
- Modify: `web/src/lib/server/apps/app-center-service.test.ts`

- [ ] **Step 1: Add failing service tests**

Cover:

- only installed and enabled applications can resolve a production binding;
- requested logical model must be enabled, use capability `video`, include the current `appKey`, and have at least one enabled ready channel binding;
- missing binding throws `PROVIDER_NOT_BOUND`;
- disabled logical model throws `LOGICAL_API_DISABLED`;
- returned tenant DTO contains logical model ID and name only;
- internal resolution returns ordered physical channel candidates without mutating admin settings.

- [ ] **Step 2: Run focused service tests and confirm failure**

```powershell
pnpm test -- src/lib/server/apps/specialized-provider-binding-service.test.ts src/lib/server/apps/app-center-service.test.ts
```

- [ ] **Step 3: Implement the service**

Expose:

```ts
listTenantAppLogicalApis(tenantId, appKey)
getTenantAppProviderBinding(tenantId, appKey)
saveTenantAppProviderBinding(tenantId, appKey, logicalModelKey, userId)
clearTenantAppProviderBinding(tenantId, appKey)
resolveTenantAppProviderCandidates(tenantId, appKey)
```

Use `getAuthSettings()` on the server and existing `resolveLogicalModelCandidates(settings, "video", logicalModelKey)`.

- [ ] **Step 4: Add failing route tests**

Verify:

- `GET` requires `tenant.apps.read`;
- `PUT` and `DELETE` require `tenant.apps.configure`;
- `PUT` rejects extra Base URL, API key, or channel fields;
- response does not contain physical channel information;
- service error codes map to stable HTTP status codes.

- [ ] **Step 5: Implement the route**

DTO:

```ts
{
    binding: { logicalModelKey: string; name: string; status: "enabled" } | null;
    available: Array<{ logicalModelKey: string; name: string }>;
}
```

- [ ] **Step 6: Re-run focused tests**

```powershell
pnpm test -- src/lib/server/apps/specialized-provider-binding-service.test.ts src/lib/server/apps/app-center-service.test.ts src/app/api/tenant/apps/[appKey]/provider-binding/route.test.ts
```

- [ ] **Step 7: Commit**

```powershell
git add web/src/lib/server/apps/specialized-provider-binding-service.ts web/src/lib/server/apps/specialized-provider-binding-service.test.ts web/src/app/api/tenant/apps/[appKey]/provider-binding/route.ts web/src/app/api/tenant/apps/[appKey]/provider-binding/route.test.ts web/src/lib/server/apps/app-center-service.ts web/src/lib/server/apps/app-center-service.test.ts
git commit -m "feat: expose tenant provider subscriptions"
```

---

## Task 4: Add Admin Mapping and Tenant Subscription Controls

**Files:**

- Modify: `web/src/components/admin/admin-logical-model-manager.tsx`
- Modify: `web/src/components/admin/admin-generation-settings.tsx`
- Modify: `web/src/components/tenant-admin/tenant-app-center-section.tsx`
- Modify: `web/src/services/api/app-center.ts`
- Modify: `web/src/services/api/app-center.test.ts`
- Modify: `web/src/services/api/admin-settings.test.ts`

- [ ] **Step 1: Add failing API client tests**

Cover:

- provider binding GET, PUT, and DELETE paths;
- request body contains only `logicalModelKey`;
- DTO excludes physical channel configuration.

- [ ] **Step 2: Run the focused client tests and confirm failure**

```powershell
pnpm test -- src/services/api/app-center.test.ts src/services/api/admin-settings.test.ts
```

- [ ] **Step 3: Add admin application scope controls**

In the logical model drawer:

- add a multi-select labeled “专项应用”;
- options are digital human, `image_human`, and action transfer;
- keep channel priority and enabled controls unchanged;
- show application scope tags in the logical model list;
- prevent an app-scoped model from being selected as the generic default video model.

- [ ] **Step 4: Add tenant single-select subscription**

For an installed specialized application:

- load provider binding details;
- render one `Select`, not a multi-select;
- show only logical APIs scoped to that application;
- save or clear the selection through the new API;
- do not display provider channel names, URLs, or keys;
- show an actionable unbound state.

- [ ] **Step 5: Re-run focused tests and typecheck**

```powershell
pnpm test -- src/services/api/app-center.test.ts src/services/api/admin-settings.test.ts
pnpm typecheck
```

- [ ] **Step 6: Commit**

```powershell
git add web/src/components/admin/admin-logical-model-manager.tsx web/src/components/admin/admin-generation-settings.tsx web/src/components/tenant-admin/tenant-app-center-section.tsx web/src/services/api/app-center.ts web/src/services/api/app-center.test.ts web/src/services/api/admin-settings.test.ts
git commit -m "feat: configure specialized provider subscriptions"
```

---

## Task 5: Extend Generation Task Scheduling for Specialized Tasks

**Files:**

- Modify: `web/src/lib/server/generation-task-types.ts`
- Modify: `web/src/lib/server/generation-task-store.ts`
- Modify: `web/src/lib/server/generation-task-scheduler.ts`
- Modify: `web/src/lib/server/generation-task-recovery-service.ts`
- Modify: `web/src/lib/server/generation-task-scheduler.test.ts`
- Modify: `web/src/lib/server/generation-task-recovery-service.test.ts`
- Modify: `web/src/lib/server/database/schema.ts`
- Modify: `web/src/lib/server/database/postgres.test.ts`

- [ ] **Step 1: Add failing scheduler tests**

Add task types:

```ts
"digital-human" | "image-human" | "action-transfer"
```

Assert:

- all three task types can be stored and scheduled;
- due tasks are leased with existing tenant and worker isolation;
- recovery dispatches each type to its dedicated runtime;
- missing specialized runtime does not fall through to generic video;
- billing reservations can reference the same specialized generation task ID.

- [ ] **Step 2: Run focused tests and confirm failure**

```powershell
pnpm test -- src/lib/server/generation-task-scheduler.test.ts src/lib/server/generation-task-recovery-service.test.ts src/lib/server/database/postgres.test.ts
```

- [ ] **Step 3: Extend task type constraints**

Update TypeScript unions, runtime guards, PostgreSQL `generation_tasks_type` constraint, schedulable type set, admin filtering labels, and recovery dispatch.

- [ ] **Step 4: Add specialized dispatch ports**

Create lazy runtime calls from recovery service:

```ts
runDigitalHumanTaskStep(lease, context)
runImageHumanTaskStep(lease, context)
runActionTransferTaskStep(lease, context)
```

At this task, temporary implementations may mark an unimplemented runtime as `needs_review`; the final handlers are supplied by Tasks 7, 9, and 10.

- [ ] **Step 5: Re-run focused tests**

```powershell
pnpm test -- src/lib/server/generation-task-scheduler.test.ts src/lib/server/generation-task-recovery-service.test.ts src/lib/server/database/postgres.test.ts
```

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/generation-task-types.ts web/src/lib/server/generation-task-store.ts web/src/lib/server/generation-task-scheduler.ts web/src/lib/server/generation-task-recovery-service.ts web/src/lib/server/generation-task-scheduler.test.ts web/src/lib/server/generation-task-recovery-service.test.ts web/src/lib/server/database/schema.ts web/src/lib/server/database/postgres.test.ts
git commit -m "feat: schedule specialized provider tasks"
```

---

## Task 6: Build Shared Specialized Provider HTTP and Response Utilities

**Files:**

- Create: `web/src/lib/server/specialized-provider/provider-types.ts`
- Create: `web/src/lib/server/specialized-provider/provider-http.ts`
- Create: `web/src/lib/server/specialized-provider/provider-http.test.ts`
- Create: `web/src/lib/server/specialized-provider/provider-response.ts`
- Create: `web/src/lib/server/specialized-provider/provider-response.test.ts`
- Create: `web/src/lib/server/specialized-provider/provider-context.ts`
- Create: `web/src/lib/server/specialized-provider/provider-context.test.ts`

**Source references:**

- `D:\homeWork\曼居code\aigc-code\app\common\service\app\aigc_digital_human\XhadminAigcDigitalHumanProvider.php`
- `D:\homeWork\曼居code\aigc-code\app\common\service\app\image_human\XhadminImageHumanProvider.php`
- `D:\homeWork\曼居code\aigc-code\app\common\service\app\aigc_action_transfer\XhadminActionTransferProvider.php`
- `https://klingai.com/document-api/api/video/avatar`

- [ ] **Step 1: Add failing HTTP tests**

Verify:

- URL joining preserves provider path semantics;
- Bearer authorization is applied server-side;
- a physical channel resolves to an explicit specialized protocol identifier;
- unknown or app-incompatible protocol identifiers are rejected before any network request;
- timeouts and non-2xx responses become typed errors;
- logs and thrown errors do not include API keys or Authorization headers;
- POST JSON and GET query behavior match source protocols.

- [ ] **Step 2: Add failing response compatibility tests**

Use fixtures covering:

- task ID in root, `data`, `result`, and nested task objects;
- status in `status`, `state`, and nested result objects;
- media URLs in audio, video, result, output, and data shapes;
- malformed success responses;
- terminal failure status normalization.

- [ ] **Step 3: Run tests and confirm failure**

```powershell
pnpm test -- src/lib/server/specialized-provider/provider-http.test.ts src/lib/server/specialized-provider/provider-response.test.ts src/lib/server/specialized-provider/provider-context.test.ts
```

- [ ] **Step 4: Implement shared utilities**

Provider context must contain server-only channel data and produce sanitized task snapshots. Do not store raw credentials in task payloads.

Add a reviewed protocol union containing at least:

```ts
type SpecializedProviderProtocol =
    | "xhadmin-digital-human-v1"
    | "kling-avatar-v1"
    | "xhadmin-image-human-v1"
    | "xhadmin-action-transfer-v1";
```

- [ ] **Step 5: Re-run focused tests**

```powershell
pnpm test -- src/lib/server/specialized-provider/provider-http.test.ts src/lib/server/specialized-provider/provider-response.test.ts src/lib/server/specialized-provider/provider-context.test.ts
```

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/specialized-provider
git commit -m "feat: add specialized provider runtime utilities"
```

---

## Task 7: Implement the Digital Human Provider State Machine

**Files:**

- Create: `web/src/lib/server/digital-human/digital-human-provider.ts`
- Create: `web/src/lib/server/digital-human/digital-human-provider.test.ts`
- Create: `web/src/lib/server/digital-human/xhadmin-digital-human-provider.ts`
- Create: `web/src/lib/server/digital-human/xhadmin-digital-human-provider.test.ts`
- Create: `web/src/lib/server/digital-human/kling-avatar-provider.ts`
- Create: `web/src/lib/server/digital-human/kling-avatar-provider.test.ts`
- Create: `web/src/lib/server/digital-human/digital-human-runtime.ts`
- Create: `web/src/lib/server/digital-human/digital-human-runtime.test.ts`
- Modify: `web/src/lib/server/database/schema-digital-human.ts`
- Modify: `web/src/lib/server/database/schema-digital-human.test.ts`
- Modify: `web/src/lib/server/database/digital-human-repository.ts`
- Modify: `web/src/lib/server/database/digital-human-repository.test.ts`
- Modify: `web/src/app/api/digital-human/tasks/route.ts`
- Modify: `web/src/app/api/digital-human/tasks/route.test.ts`
- Modify: `web/src/app/api/digital-human/tasks/[id]/route.ts`
- Modify: `web/src/lib/server/generation-task-recovery-service.ts`
- Modify: `web/src/lib/server/generation-task-recovery-service.test.ts`

**Source reference:**

- `D:\homeWork\曼居code\aigc-code\app\common\service\app\aigc_digital_human\XhadminAigcDigitalHumanProvider.php`
- `https://klingai.com/document-api/api/video/avatar`

- [ ] **Step 1: Add failing provider selection tests**

Verify:

- `xhadmin-digital-human-v1` creates the Xhadmin adapter;
- `kling-avatar-v1` creates the Kling adapter;
- app-incompatible and unknown protocol identifiers fail closed;
- tenant responses expose only the logical model and normalized task state.

- [ ] **Step 2: Add failing Xhadmin protocol tests**

Verify exact protocols:

- `POST /api/v1/apps/voice_tts/tts_live`
- `POST /api/v1/apps/voice_tts/clone_voice`
- `POST /api/v1/apps/lipsync/submit`
- `GET /api/v1/tasks/{task_id}`

Verify source-compatible fields:

- `client_task_id`
- `idempotency_key`
- `local_task_id`
- `local_task_sn`

- [ ] **Step 3: Add failing Kling Avatar protocol tests**

Create fixtures directly from the official Avatar API documentation and verify:

- exact create-task path and HTTP method;
- exact query-task path and HTTP method;
- official authentication behavior;
- required avatar, audio or text inputs;
- provider task ID extraction;
- processing, success, and failure status mapping;
- final video URL extraction;
- sanitized errors without credentials or raw authorization data.

Do not infer missing Kling fields from the Xhadmin protocol. When the official protocol changes, update only the Kling adapter fixtures and mapping.

- [ ] **Step 4: Add failing repository and state transition tests**

Add fields required for:

- logical model and physical channel snapshots;
- provider protocol snapshot;
- TTS task ID;
- lipsync task ID;
- Avatar task ID;
- intermediate audio URL;
- request and pricing snapshots;
- retry counters and diagnostic errors.

Test legal transitions:

```text
queued -> submitting_tts -> waiting_tts
waiting_tts -> submitting_lipsync -> waiting_lipsync
waiting_lipsync -> persisting_result -> succeeded

queued -> submitting_avatar -> waiting_avatar
waiting_avatar -> persisting_result -> succeeded
```

- [ ] **Step 5: Run focused tests and confirm failure**

```powershell
pnpm test -- src/lib/server/digital-human/digital-human-provider.test.ts src/lib/server/digital-human/xhadmin-digital-human-provider.test.ts src/lib/server/digital-human/kling-avatar-provider.test.ts src/lib/server/digital-human/digital-human-runtime.test.ts src/lib/server/database/digital-human-repository.test.ts src/lib/server/database/schema-digital-human.test.ts src/app/api/digital-human/tasks/route.test.ts src/lib/server/generation-task-recovery-service.test.ts
```

- [ ] **Step 6: Create task transactionally**

The creation path must:

1. validate avatar, voice, and script ownership;
2. require the installed `aigc-digital-human` application;
3. resolve the tenant provider binding;
4. create `digital_human_tasks`;
5. create a same-ID `generation_tasks` record with type `digital-human`;
6. reserve billing with immutable logical model, channel candidate, pricing, and app snapshots;
7. schedule the task at `executionPhase = created`.

- [ ] **Step 7: Implement resumable runtime stages**

Rules:

- before the first upstream task submission succeeds, candidates may fail over in priority order;
- after any provider task ID is accepted, pin the physical channel and protocol;
- for Xhadmin, persist the TTS audio URL before lipsync submission;
- for Kling, use the independent Avatar adapter and persist its provider state without translating it into fake TTS/Lipsync stages;
- preserve stage state across service restarts;
- unknown provider success shapes enter `needs_review`, not `success`;
- final success occurs only after video media persistence and result row creation.

- [ ] **Step 8: Integrate settlement and release**

- settle the reservation after final media persistence;
- release the reservation on permanent provider failure;
- use idempotency keys derived from the local task ID and operation;
- do not charge again when Worker repeats a completed stage.

- [ ] **Step 9: Re-run focused tests**

```powershell
pnpm test -- src/lib/server/digital-human/digital-human-provider.test.ts src/lib/server/digital-human/xhadmin-digital-human-provider.test.ts src/lib/server/digital-human/kling-avatar-provider.test.ts src/lib/server/digital-human/digital-human-runtime.test.ts src/lib/server/database/digital-human-repository.test.ts src/lib/server/database/schema-digital-human.test.ts src/app/api/digital-human/tasks/route.test.ts src/lib/server/generation-task-recovery-service.test.ts
```

- [ ] **Step 10: Commit**

```powershell
git add web/src/lib/server/digital-human web/src/lib/server/database/schema-digital-human.ts web/src/lib/server/database/schema-digital-human.test.ts web/src/lib/server/database/digital-human-repository.ts web/src/lib/server/database/digital-human-repository.test.ts web/src/app/api/digital-human/tasks web/src/lib/server/generation-task-recovery-service.ts web/src/lib/server/generation-task-recovery-service.test.ts
git commit -m "feat: run digital human provider tasks"
```

---

## Task 8: Register Specialized Applications

**Files:**

- Modify: `web/src/lib/apps/app-definition.ts`
- Modify: `web/src/lib/apps/app-registry.ts`
- Modify: `web/src/lib/apps/app-registry.test.ts`
- Create: `web/src/lib/apps/definitions/aigc-digital-human.ts`
- Create: `web/src/lib/apps/definitions/image-human.ts`
- Create: `web/src/lib/apps/definitions/action-transfer.ts`
- Modify: `web/src/components/admin/admin-app-center-section.tsx`

- [ ] **Step 1: Add failing registry tests**

Assert all three definitions:

- use reviewed immutable versions;
- have video output;
- declare the correct workflow;
- provide source-compatible input fields;
- carry default point pricing;
- can be published and installed through the existing application center.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
pnpm test -- src/lib/apps/app-registry.test.ts src/lib/server/apps/app-center-service.test.ts
```

- [ ] **Step 3: Add workflow keys and definitions**

Add:

- `aigc-digital-human.v1`
- `image-human.v1`
- `action-transfer.v1`

Do not place secrets or physical channel settings in app definitions.

- [ ] **Step 4: Re-run focused tests**

```powershell
pnpm test -- src/lib/apps/app-registry.test.ts src/lib/server/apps/app-center-service.test.ts
```

- [ ] **Step 5: Commit**

```powershell
git add web/src/lib/apps web/src/components/admin/admin-app-center-section.tsx
git commit -m "feat: register specialized provider applications"
```

---

## Task 9: Implement Image Human

**Files:**

- Create: `web/src/lib/server/database/schema-image-human.ts`
- Create: `web/src/lib/server/database/schema-image-human.test.ts`
- Create: `web/src/lib/server/database/image-human-repository.ts`
- Create: `web/src/lib/server/database/image-human-repository.test.ts`
- Modify: `web/src/lib/server/database/schema.ts`
- Modify: `web/src/lib/server/database/postgres.ts`
- Modify: `web/src/lib/server/database/repositories.ts`
- Create: `web/src/lib/server/image-human/image-human-provider.ts`
- Create: `web/src/lib/server/image-human/image-human-provider.test.ts`
- Create: `web/src/lib/server/image-human/image-human-runtime.ts`
- Create: `web/src/lib/server/image-human/image-human-runtime.test.ts`
- Create: `web/src/lib/server/image-human/image-human-validation.ts`
- Create: `web/src/lib/server/image-human/image-human-validation.test.ts`
- Create: `web/src/lib/server/image-human/image-human-access.ts`
- Create: `web/src/app/api/image-human/tasks/route.ts`
- Create: `web/src/app/api/image-human/tasks/route.test.ts`
- Create: `web/src/app/api/image-human/tasks/[id]/route.ts`
- Create: `web/src/app/api/image-human/results/route.ts`
- Create: `web/src/app/(user)/image-human/page.tsx`
- Create: `web/src/app/(user)/image-human/image-human-workspace.tsx`
- Modify: `web/src/lib/server/generation-task-recovery-service.ts`
- Modify: `web/src/constant/navigation-tools.ts`

**Source reference:**

- `D:\homeWork\曼居code\aigc-code\app\common\service\app\image_human\XhadminImageHumanProvider.php`
- `D:\homeWork\曼居code\aigc-code\app\apps\image_human\api_schema.json`

- [ ] **Step 1: Add failing protocol tests**

Verify:

- submit uses `POST /api/v1/apps/image_human/submit`;
- primary query uses `POST /api/v1/apps/image_human/query`;
- fallback query uses `GET /api/v1/tasks/{task_id}` only for eligible `task_` IDs;
- payload preserves `file_url`, `ref_file_url`, `script_text`, `prompt`, `duration`, `mode`, and idempotency fields.

- [ ] **Step 2: Add failing validation and repository tests**

Verify:

- input media must use externally accessible HTTPS URLs;
- localhost, loopback, private network, file paths, and unsupported protocols are rejected;
- all CRUD is tenant and user scoped;
- task creation also inserts a same-ID `generation_tasks` row;
- result creation is idempotent.

- [ ] **Step 3: Run focused tests and confirm failure**

```powershell
pnpm test -- src/lib/server/image-human/image-human-provider.test.ts src/lib/server/image-human/image-human-runtime.test.ts src/lib/server/image-human/image-human-validation.test.ts src/lib/server/database/image-human-repository.test.ts src/lib/server/database/schema-image-human.test.ts src/app/api/image-human/tasks/route.test.ts
```

- [ ] **Step 4: Implement schema, repository, API, and runtime**

State flow:

```text
queued -> submitting -> waiting_provider -> persisting_result -> succeeded
```

Use the installed `image-human` application and its tenant provider binding.

- [ ] **Step 5: Implement workspace**

The first screen must be the usable tool:

- source image;
- reference media;
- script;
- prompt;
- duration;
- mode;
- task history and results.

Follow existing VOZEB-PRO workbench layout and controls.

- [ ] **Step 6: Re-run focused tests and typecheck**

```powershell
pnpm test -- src/lib/server/image-human src/lib/server/database/image-human-repository.test.ts src/lib/server/database/schema-image-human.test.ts src/app/api/image-human
pnpm typecheck
```

- [ ] **Step 7: Commit**

```powershell
git add web/src/lib/server/database/schema-image-human.ts web/src/lib/server/database/schema-image-human.test.ts web/src/lib/server/database/image-human-repository.ts web/src/lib/server/database/image-human-repository.test.ts web/src/lib/server/database/schema.ts web/src/lib/server/database/postgres.ts web/src/lib/server/database/repositories.ts web/src/lib/server/image-human web/src/app/api/image-human web/src/app/(user)/image-human web/src/lib/server/generation-task-recovery-service.ts web/src/constant/navigation-tools.ts
git commit -m "feat: migrate image human provider workflow"
```

---

## Task 10: Implement Action Transfer

**Files:**

- Create: `web/src/lib/server/database/schema-action-transfer.ts`
- Create: `web/src/lib/server/database/schema-action-transfer.test.ts`
- Create: `web/src/lib/server/database/action-transfer-repository.ts`
- Create: `web/src/lib/server/database/action-transfer-repository.test.ts`
- Modify: `web/src/lib/server/database/schema.ts`
- Modify: `web/src/lib/server/database/postgres.ts`
- Modify: `web/src/lib/server/database/repositories.ts`
- Create: `web/src/lib/server/action-transfer/action-transfer-provider.ts`
- Create: `web/src/lib/server/action-transfer/action-transfer-provider.test.ts`
- Create: `web/src/lib/server/action-transfer/action-transfer-runtime.ts`
- Create: `web/src/lib/server/action-transfer/action-transfer-runtime.test.ts`
- Create: `web/src/lib/server/action-transfer/action-transfer-validation.ts`
- Create: `web/src/lib/server/action-transfer/action-transfer-validation.test.ts`
- Create: `web/src/lib/server/action-transfer/action-transfer-access.ts`
- Create: `web/src/app/api/action-transfer/tasks/route.ts`
- Create: `web/src/app/api/action-transfer/tasks/route.test.ts`
- Create: `web/src/app/api/action-transfer/tasks/[id]/route.ts`
- Create: `web/src/app/api/action-transfer/results/route.ts`
- Create: `web/src/app/(user)/action-transfer/page.tsx`
- Create: `web/src/app/(user)/action-transfer/action-transfer-workspace.tsx`
- Modify: `web/src/lib/server/generation-task-recovery-service.ts`
- Modify: `web/src/constant/navigation-tools.ts`

**Source reference:**

- `D:\homeWork\曼居code\aigc-code\app\common\service\app\aigc_action_transfer\XhadminActionTransferProvider.php`
- `D:\homeWork\曼居code\aigc-code\app\apps\aigc_action_transfer\api_schema.json`

- [ ] **Step 1: Add failing protocol tests**

Verify:

- submit uses `POST /api/v1/apps/action_transfer/submit`;
- query uses `POST /api/v1/apps/action_transfer/query`;
- payload contains `type = action_transfer`;
- source-compatible media and idempotency fields are preserved;
- generated video result extraction matches source compatibility rules.

- [ ] **Step 2: Add failing repository, validation, and route tests**

Cover tenant isolation, media validation, unique task/result handling, app installation, provider binding, and same-ID generation task creation.

- [ ] **Step 3: Run focused tests and confirm failure**

```powershell
pnpm test -- src/lib/server/action-transfer src/lib/server/database/action-transfer-repository.test.ts src/lib/server/database/schema-action-transfer.test.ts src/app/api/action-transfer
```

- [ ] **Step 4: Implement schema, runtime, API, and workspace**

State flow:

```text
queued -> submitting -> waiting_provider -> persisting_result -> succeeded
```

The user workspace must preserve the source module's business inputs without exposing provider configuration.

- [ ] **Step 5: Re-run focused tests and typecheck**

```powershell
pnpm test -- src/lib/server/action-transfer src/lib/server/database/action-transfer-repository.test.ts src/lib/server/database/schema-action-transfer.test.ts src/app/api/action-transfer
pnpm typecheck
```

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/database/schema-action-transfer.ts web/src/lib/server/database/schema-action-transfer.test.ts web/src/lib/server/database/action-transfer-repository.ts web/src/lib/server/database/action-transfer-repository.test.ts web/src/lib/server/database/schema.ts web/src/lib/server/database/postgres.ts web/src/lib/server/database/repositories.ts web/src/lib/server/action-transfer web/src/app/api/action-transfer web/src/app/(user)/action-transfer web/src/lib/server/generation-task-recovery-service.ts web/src/constant/navigation-tools.ts
git commit -m "feat: migrate action transfer provider workflow"
```

---

## Task 11: Harden Billing, Media Persistence, and Security

**Files:**

- Create: `web/src/lib/server/specialized-provider/specialized-task-billing.ts`
- Create: `web/src/lib/server/specialized-provider/specialized-task-billing.test.ts`
- Create: `web/src/lib/server/specialized-provider/specialized-media-persistence.ts`
- Create: `web/src/lib/server/specialized-provider/specialized-media-persistence.test.ts`
- Modify: `web/src/lib/server/media-download.ts`
- Modify: `web/src/lib/server/media-content-validation.ts`
- Modify: `web/src/lib/server/billing/task-billing-service.test.ts`
- Modify: `web/src/lib/server/generation-task-retention.ts`
- Modify: `web/src/lib/server/generation-task-retention.test.ts`

- [ ] **Step 1: Add failing billing tests**

Verify:

- reservation is created once;
- retries do not double charge;
- success settles sale and cost snapshots;
- permanent failure releases the reservation;
- post-settlement reversal follows existing refund orchestration;
- partial provider cost does not silently increase tenant sale charge.

- [ ] **Step 2: Add failing media security tests**

Verify:

- generated videos are downloaded with size and content validation;
- executable or mismatched media is rejected;
- private-network result URLs are rejected unless they are signed internal VOZEB-PRO media;
- persisted output becomes a permanent tenant-scoped media asset;
- repeated persistence returns the existing result.

- [ ] **Step 3: Run focused tests and confirm failure**

```powershell
pnpm test -- src/lib/server/specialized-provider/specialized-task-billing.test.ts src/lib/server/specialized-provider/specialized-media-persistence.test.ts src/lib/server/billing/task-billing-service.test.ts src/lib/server/generation-task-retention.test.ts
```

- [ ] **Step 4: Implement shared billing and persistence orchestration**

Do not duplicate account mutation logic; call existing `TaskBillingService`.

- [ ] **Step 5: Re-run focused tests**

```powershell
pnpm test -- src/lib/server/specialized-provider/specialized-task-billing.test.ts src/lib/server/specialized-provider/specialized-media-persistence.test.ts src/lib/server/billing/task-billing-service.test.ts src/lib/server/generation-task-retention.test.ts
```

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/specialized-provider web/src/lib/server/media-download.ts web/src/lib/server/media-content-validation.ts web/src/lib/server/billing/task-billing-service.test.ts web/src/lib/server/generation-task-retention.ts web/src/lib/server/generation-task-retention.test.ts
git commit -m "feat: harden specialized task settlement"
```

---

## Task 12: End-to-End Verification and Local Deployment

**Files:**

- Create: `web/e2e/specialized-provider-admin.spec.ts`
- Create: `web/e2e/specialized-provider-tenant.spec.ts`
- Create: `web/e2e/digital-human-provider.spec.ts`
- Create: `web/e2e/image-human-provider.spec.ts`
- Create: `web/e2e/action-transfer-provider.spec.ts`
- Modify: `web/.env.example`
- Modify: `web/README.md`
- Modify: `docs/superpowers/specs/2026-08-08-specialized-provider-integration-design.md`

- [ ] **Step 1: Add deterministic provider fixture**

Use an in-test HTTP fixture that emulates:

- digital human Xhadmin TTS/Lipsync and Kling Avatar stages;
- `image_human` submit, primary query, and fallback query;
- action transfer submit and query;
- transient errors, terminal errors, malformed responses, and delayed completion.

Do not require real paid provider credentials in automated tests.

- [ ] **Step 2: Add E2E tests**

Verify:

- super admin maps channels to scoped logical APIs;
- tenant installs each application and can select exactly one logical API;
- tenant responses never expose channel secrets;
- each application creates and completes a provider task;
- Worker restart resumes pending tasks;
- two tenants cannot read each other's tasks or results;
- failure releases billing;
- successful result appears in task history and result list.

- [ ] **Step 3: Run complete verification**

```powershell
cd D:\homeWork\saas-api\VOZEB-PRO\.worktrees\saas-foundation\web
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm e2e -- specialized-provider-admin.spec.ts specialized-provider-tenant.spec.ts digital-human-provider.spec.ts image-human-provider.spec.ts action-transfer-provider.spec.ts
```

- [ ] **Step 4: Verify PostgreSQL lifecycle**

Against the local PostgreSQL container:

- initialize schema;
- verify all new tables;
- verify generation task constraints;
- verify binding uniqueness;
- verify application definitions can be published and installed.

- [ ] **Step 5: Run local production deployment**

Start the production server and generation worker as detached processes. Verify:

```text
GET /api/health/ready
GET /digital-human
GET /image-human
GET /action-transfer
GET /admin
```

- [ ] **Step 6: Record final migration checklist**

Update the design document with:

- completed implementation commits;
- provider protocol deviations, if any;
- required production environment variables;
- database migration status;
- known operational limitations.

- [ ] **Step 7: Commit**

```powershell
git add web/e2e web/.env.example web/README.md docs/superpowers/specs/2026-08-08-specialized-provider-integration-design.md
git commit -m "test: verify specialized provider migration"
```

---

## Completion Criteria

The plan is complete only when:

1. Each specialized app is published in the application center.
2. Each tenant app can bind exactly one scoped logical API.
3. Physical channel credentials remain platform-only.
4. Digital human completes either the source-compatible Xhadmin TTS/Lipsync sequence or the official Kling Avatar sequence selected by the physical channel protocol.
5. `image_human` and action transfer complete source-compatible submit and query sequences.
6. All specialized tasks use same-ID `generation_tasks` records.
7. Worker restart recovery, billing idempotency, media persistence, and tenant isolation are verified.
8. Full unit tests, Lint, typecheck, production build, E2E tests, PostgreSQL lifecycle, and local production health checks pass.
