# Billing, Power, and Payment Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce separate tenant-user sale, platform AI cost, and platform-collection settlement ledgers, then support both platform and tenant merchant accounts through the existing VOZEB order lifecycle.

**Architecture:** Immutable ledger entries are the commercial source of truth. Mutable account balances are transactionally updated projections protected by row locks and idempotency keys. Application task reservation and settlement are provider-independent. Payment checkout resolves a merchant account before creating provider requests, and webhooks resolve the merchant before trusting any tenant relationship.

**Tech Stack:** TypeScript 5, PostgreSQL transactions and row locks, Next.js Route Handlers, existing VOZEB billing/payment adapters, Vitest, Playwright.

## Global Constraints

- Complete Application Center Task 6 before integrating task settlement.
- Store money and points as integers in the smallest declared unit.
- Never derive tenant sale revenue from platform AI cost or the reverse.
- Ledger rows are append-only; corrections are reversal entries.
- Every reserve, settle, release, reverse, payment, refund, and webhook operation has a unique idempotency boundary.
- Platform collection creates settlement ledger entries but does not implement automatic bank payout in the MVP.
- Tenant collection never credits a platform settlement balance.
- Provider and merchant secrets stay encrypted at rest and are redacted from logs and API responses.
- Existing platform checkout remains functional after migration.
- Implement with TDD and commit after every task.

---

## Task 1: Add SaaS Billing and Merchant Schema

**Files:**

- Create: `web/src/lib/server/database/schema-saas-billing.ts`
- Modify: `web/src/lib/server/database/schema.ts`
- Modify: `web/src/lib/server/database/postgres.ts`
- Modify: `web/src/lib/server/database/postgres.test.ts`

- [ ] **Step 1: Add failing schema assertions**

Assert these prefixed tables are included:

```ts
const saasBillingTables = [
    "tenant_user_wallets",
    "tenant_user_ledger_entries",
    "tenant_power_accounts",
    "tenant_power_ledger_entries",
    "tenant_settlement_accounts",
    "tenant_settlement_ledger_entries",
    "merchant_accounts",
    "task_billing_reservations",
];
```

- [ ] **Step 2: Run the focused test and confirm failure**

```powershell
cd D:\homeWork\saas-api\VOZEB-PRO\web
pnpm test -- src/lib/server/database/postgres.test.ts
```

Expected: failure because the eight tables are absent.

- [ ] **Step 3: Define account and immutable ledger DDL**

Each account table has `available_amount`, `reserved_amount`, `version`, and timestamps. Each ledger has `amount`, `direction`, `entry_type`, `reference_type`, `reference_id`, `idempotency_key`, `reversal_of_id`, `metadata_json`, and `created_at`.

Use this shape for tenant-user wallets:

```sql
CREATE TABLE IF NOT EXISTS tenant_user_wallets (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    currency TEXT NOT NULL,
    available_amount BIGINT NOT NULL DEFAULT 0,
    reserved_amount BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (tenant_id, user_id, currency),
    CHECK (available_amount >= 0),
    CHECK (reserved_amount >= 0)
);
```

Add the other account and immutable ledger tables explicitly:

```sql
CREATE TABLE IF NOT EXISTS tenant_user_wallet_ledger_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    account_id TEXT NOT NULL REFERENCES tenant_user_wallets(id),
    amount BIGINT NOT NULL CHECK (amount > 0),
    direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    entry_type TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    reversal_of_id TEXT REFERENCES tenant_user_wallet_ledger_entries(id),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    UNIQUE (account_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS tenant_power_accounts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    unit TEXT NOT NULL,
    available_amount BIGINT NOT NULL DEFAULT 0,
    reserved_amount BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (tenant_id, unit),
    CHECK (available_amount >= 0),
    CHECK (reserved_amount >= 0)
);

CREATE TABLE IF NOT EXISTS tenant_power_ledger_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    account_id TEXT NOT NULL REFERENCES tenant_power_accounts(id),
    amount BIGINT NOT NULL CHECK (amount > 0),
    direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    entry_type TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    reversal_of_id TEXT REFERENCES tenant_power_ledger_entries(id),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    UNIQUE (account_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS tenant_settlement_accounts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    currency TEXT NOT NULL,
    available_amount BIGINT NOT NULL DEFAULT 0,
    reserved_amount BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (tenant_id, currency),
    CHECK (available_amount >= 0),
    CHECK (reserved_amount >= 0)
);

CREATE TABLE IF NOT EXISTS tenant_settlement_ledger_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    account_id TEXT NOT NULL REFERENCES tenant_settlement_accounts(id),
    amount BIGINT NOT NULL CHECK (amount > 0),
    direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    entry_type TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    reversal_of_id TEXT REFERENCES tenant_settlement_ledger_entries(id),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    UNIQUE (account_id, idempotency_key)
);
```

- [ ] **Step 4: Define task reservations and merchant accounts**

```sql
CREATE TABLE IF NOT EXISTS task_billing_reservations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    generation_task_id TEXT NOT NULL REFERENCES generation_tasks(id),
    user_wallet_id TEXT NOT NULL REFERENCES tenant_user_wallets(id),
    power_account_id TEXT NOT NULL REFERENCES tenant_power_accounts(id),
    sale_reserved BIGINT NOT NULL,
    cost_reserved BIGINT NOT NULL,
    sale_settled BIGINT NOT NULL DEFAULT 0,
    cost_settled BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'released', 'reversed')),
    idempotency_key TEXT NOT NULL,
    snapshot_json JSONB NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (tenant_id, generation_task_id),
    UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS merchant_accounts (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('platform', 'tenant')),
    owner_id TEXT NOT NULL,
    tenant_id TEXT REFERENCES tenants(id),
    provider TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('test', 'production')),
    status TEXT NOT NULL CHECK (status IN ('enabled', 'disabled')),
    encrypted_config TEXT NOT NULL,
    webhook_identity TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (provider, environment, webhook_identity)
);
```

- [ ] **Step 5: Extend existing commercial tables**

Plan 1 already adds non-null `billing_orders.tenant_id`. Add the remaining order lineage columns:

```sql
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS collection_mode TEXT;
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS merchant_account_id TEXT REFERENCES merchant_accounts(id);
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS beneficiary_type TEXT;
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS commercial_snapshot_json JSONB;
```

Add nullable-first `tenant_id` and `merchant_account_id` lineage to payment transactions and refunds. Plan 4 performs their default-tenant backfill and final non-null/check constraints.

- [ ] **Step 6: Register lifecycle metadata**

Add the eight table names and index names to `postgres.ts`. Update the expected table count from `69` to `77`.

- [ ] **Step 7: Run tests and commit**

```powershell
pnpm test -- src/lib/server/database/postgres.test.ts
git add web/src/lib/server/database/schema-saas-billing.ts web/src/lib/server/database/schema.ts web/src/lib/server/database/postgres.ts web/src/lib/server/database/postgres.test.ts
git commit -m "feat: add saas billing and merchant schema"
```

Expected: test passes and commit succeeds.

---

## Task 2: Implement Transactional Account and Ledger Repositories

**Files:**

- Create: `web/src/lib/server/database/tenant-wallet-repository.ts`
- Create: `web/src/lib/server/database/tenant-power-repository.ts`
- Create: `web/src/lib/server/database/tenant-settlement-repository.ts`
- Create: `web/src/lib/server/database/tenant-ledger-repositories.postgres.test.ts`
- Modify: `web/src/lib/server/database/repositories.ts`

- [ ] **Step 1: Write PostgreSQL concurrency tests**

Cover:

- Two concurrent reservations cannot spend the same available balance.
- Replaying an idempotency key returns the original ledger entry.
- Tenant A cannot mutate Tenant B's account.
- A reversal references the original entry and cannot itself be reversed twice.

- [ ] **Step 2: Run and confirm failure**

```powershell
$env:VOZEB_PRO_DATABASE_PROVIDER='postgres'
pnpm test -- src/lib/server/database/tenant-ledger-repositories.postgres.test.ts
```

Expected: failure because repositories do not exist.

- [ ] **Step 3: Define shared repository contracts**

```ts
export type AccountMutation = Readonly<{
    tenantId: string;
    accountId: string;
    amount: number;
    referenceType: string;
    referenceId: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
}>;

export interface ReservableAccountRepository {
    reserve(input: AccountMutation): Promise<LedgerMutationResult>;
    settle(input: AccountMutation & { actualAmount: number }): Promise<LedgerMutationResult>;
    release(input: AccountMutation): Promise<LedgerMutationResult>;
    reverse(input: AccountMutation & { originalEntryId: string }): Promise<LedgerMutationResult>;
}
```

- [ ] **Step 4: Implement row-locked transactions**

Inside a single database transaction:

1. Load the account with `SELECT ... FOR UPDATE`.
2. Return the existing ledger result for a duplicate idempotency key.
3. Check available or reserved amount.
4. Insert the immutable ledger entry.
5. Update account projection and increment `version`.

Map PostgreSQL unique conflicts to idempotent reads instead of `500`.

- [ ] **Step 5: Register repositories and run tests**

```powershell
pnpm test -- src/lib/server/database/tenant-ledger-repositories.postgres.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/server/database/tenant-wallet-repository.ts web/src/lib/server/database/tenant-power-repository.ts web/src/lib/server/database/tenant-settlement-repository.ts web/src/lib/server/database/tenant-ledger-repositories.postgres.test.ts web/src/lib/server/database/repositories.ts
git commit -m "feat: add transactional tenant ledgers"
```

---

## Task 3: Implement Double-Sided Task Billing

**Files:**

- Create: `web/src/lib/server/billing/task-billing-types.ts`
- Create: `web/src/lib/server/billing/task-billing-service.ts`
- Create: `web/src/lib/server/billing/task-billing-service.test.ts`
- Create: `web/src/lib/server/database/task-billing-repository.ts`
- Create: `web/src/lib/server/database/task-billing-repository.test.ts`
- Modify: `web/src/lib/server/apps/tenant-app-runtime.ts`
- Create: `web/src/lib/server/apps/tenant-app-runtime.test.ts`

- [x] **Step 1: Write state-machine tests**

Test valid transitions:

```text
none -> reserved -> settled
none -> reserved -> released
reserved -> settled -> reversed
```

Reject direct `settled -> released`, mismatched tenant/task IDs, negative values, and duplicate reservations.

- [x] **Step 2: Define the task billing service**

```ts
export interface TaskBillingService {
    reserve(input: ReserveTaskBillingInput): Promise<TaskBillingReservation>;
    settle(input: {
        tenantId: string;
        generationTaskId: string;
        actualSaleAmount: number;
        actualCostAmount: number;
        idempotencyKey: string;
    }): Promise<TaskBillingReservation>;
    release(input: TaskBillingCommand): Promise<TaskBillingReservation>;
    reverse(input: TaskBillingCommand): Promise<TaskBillingReservation>;
}
```

`reserve` must reserve the tenant-user sale amount and tenant power cost in one PostgreSQL transaction. If either side is insufficient, neither side changes.

- [x] **Step 3: Implement partial-workflow settlement**

`actualSaleAmount` and `actualCostAmount` may be lower than reserved amounts. Settle actual amounts and release the remainder in the same transaction. Persist the exact task snapshot used for calculation.

- [x] **Step 4: Replace the compatibility billing port**

The current VOZEB-PRO tree does not contain the planned `app-runtime-service.ts`. The compatibility boundary is implemented in `tenant-app-runtime.ts` through `AppTaskBillingPort` and `createTenantAppTaskBillingPort`; historical requests without `appKey` retain the existing points path until the terminal-event hook migrates them.

Adapt `TaskBillingService.reserve` to `AppTaskBillingPort` in `tenant-app-runtime.ts`. Do not silently fall back to the legacy global points wallet when SaaS app execution is enabled.

- [x] **Step 5: Run tests**

```powershell
pnpm test -- src/lib/server/billing/task-billing-service.test.ts src/lib/server/database/task-billing-repository.test.ts src/lib/server/apps/app-runtime-service.test.ts
```

Expected: pass.

- [x] **Step 6: Commit**

```powershell
git add web/src/lib/server/billing web/src/lib/server/database/task-billing-repository.ts web/src/lib/server/database/task-billing-repository.test.ts web/src/lib/server/apps/app-runtime-service.ts web/src/lib/server/apps/app-runtime-service.test.ts
git commit -m "feat: add double sided task billing"
```

---

## Task 4: Settle Billing from Generation Task Terminal Events

**Files:**

- Create: `web/src/lib/server/billing/generation-task-billing-hook.ts`
- Create: `web/src/lib/server/billing/generation-task-billing-hook.test.ts`
- Modify: `web/src/lib/server/generation-task-store.ts`
- Modify: `web/src/lib/server/generation-task-store.test.ts`
- Modify: `web/src/lib/server/generation-task-types.ts`

- [x] **Step 1: Write terminal-event replay tests**

Verify that:

- Success settles once even when webhook and poller both report success.
- Failure releases once.
- Cancellation releases once.
- A successful partial workflow settles only billable completed steps.
- Manual reversal after settlement creates opposite ledger entries.

- [x] **Step 2: Implement one terminal hook**

```ts
export async function applyGenerationTaskBillingOutcome(input: {
    tenantId: string;
    generationTaskId: string;
    outcome: "success" | "error" | "cancelled";
    billableUsage?: { saleAmount: number; costAmount: number };
    sourceEventId: string;
}): Promise<void>;
```

Derive idempotency keys from `generationTaskId + outcome + sourceEventId`. Load the stored snapshot; never recalculate historical prices from current app settings.

- [x] **Step 3: Call the hook after task persistence**

Webhook, scheduler, cancellation, and recovery paths converge on `transitionStoredGenerationTask` or `mutateStoredGenerationTask`, so invoke the hook there after durable persistence. A billing-hook failure is recorded in `payload.taskBilling`, remains retryable through the idempotent task outcome boundary, and never rewrites a successful generation result to failure.

- [x] **Step 4: Run regression tests**

```powershell
pnpm test -- src/lib/server/billing/generation-task-billing-hook.test.ts src/lib/server/generation-task-store.test.ts src/lib/server/generation-task-webhook.test.ts src/lib/server/generation-task-scheduler.test.ts src/lib/server/generation-task-recovery-service.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/lib/server/billing/generation-task-billing-hook.ts web/src/lib/server/billing/generation-task-billing-hook.test.ts web/src/lib/server/generation-task-store.ts web/src/lib/server/generation-task-store.test.ts web/src/lib/server/generation-task-types.ts docs/superpowers/plans/2026-08-07-billing-power-payment-hub.md
git commit -m "feat: settle app billing from task outcomes"
```

---

## Task 5: Add Merchant Account Configuration

**Files:**

- Create: `web/src/lib/server/database/merchant-account-repository.ts`
- Create: `web/src/lib/server/database/merchant-account-repository.test.ts`
- Create: `web/src/lib/server/payment/merchant-account-service.ts`
- Create: `web/src/lib/server/payment/merchant-account-service.test.ts`
- Create: `web/src/app/api/admin/billing/merchant-accounts/route.ts`
- Create: `web/src/app/api/tenant/billing/merchant-accounts/route.ts`
- Create: `web/src/app/api/tenant/billing/merchant-accounts/route.test.ts`
- Modify: `web/src/app/api/admin/billing/merchant-accounts/route.test.ts`
- Modify: `web/src/lib/server/database/index.ts`
- Modify: `web/src/lib/server/database/postgres.ts`
- Modify: `web/src/lib/server/database/postgres.test.ts`
- Modify: `web/src/lib/server/database/repositories.ts`
- Modify: `web/src/lib/server/database/schema-saas-billing.ts`
- Modify: `web/src/lib/server/payment-config-store.ts`
- Modify: `web/src/lib/server/payment-config-store.test.ts`

- [x] **Step 1: Write encryption, ownership, and redaction tests**

Test that stored configuration is encrypted, list responses expose only status metadata, tenant administrators cannot read platform merchants or other tenants, and only one enabled account exists per owner/provider/environment.

- [x] **Step 2: Define public and secret types**

```ts
export type MerchantAccountSummary = {
    id: string;
    ownerType: "platform" | "tenant";
    provider: string;
    environment: "test" | "production";
    status: "enabled" | "disabled";
    configuredFields: string[];
};

export type SaveMerchantAccountInput = {
    provider: string;
    environment: "test" | "production";
    credentials: Record<string, string>;
    webhookIdentity: string;
};
```

- [x] **Step 3: Reuse existing encryption**

Serialize merchant credentials as JSON and encrypt the full payload with `encryptSecretValue`; decrypt only inside server-side checkout, webhook, and refund services with `decryptSecretValue`. Add an idempotent bootstrap function that reads `getPaymentRuntimeConfig()`, creates platform-owned `merchant_accounts` rows for configured providers, and records a stable bootstrap idempotency key. Keep read compatibility with the singleton configuration until Plan 4 removes that path.

- [x] **Step 4: Implement APIs**

- Platform route requires `platform.billing.manage`.
- Tenant route requires `tenant.merchants.manage`.
- `GET` returns summaries only.
- `PUT` validates provider fields and encrypts credentials.
- `DELETE` disables the account; it does not delete historical merchant identity.

- [x] **Step 5: Run tests and commit**

```powershell
pnpm test -- src/lib/server/database/merchant-account-repository.test.ts src/lib/server/payment/merchant-account-service.test.ts src/lib/server/payment-config-store.test.ts src/app/api/admin/billing/merchant-accounts src/app/api/tenant/billing/merchant-accounts
git add web/src/lib/server/database/merchant-account-repository.ts web/src/lib/server/database/merchant-account-repository.test.ts web/src/lib/server/payment web/src/app/api/admin/billing/merchant-accounts web/src/app/api/tenant/billing/merchant-accounts web/src/lib/server/payment-config-store.ts web/src/lib/server/payment-config-store.test.ts
git commit -m "feat: add scoped merchant accounts"
```

---

## Task 6: Make Orders and Checkout Merchant-Aware

**Files:**

- Modify: `web/src/lib/server/payment-checkout-types.ts`
- Modify: `web/src/lib/server/payment-checkout-service.ts`
- Modify: `web/src/lib/server/payment-checkout-service.test.ts`
- Modify: `web/src/lib/server/payment-checkout-providers.ts`
- Modify: `web/src/lib/server/database/billing-order-repository.ts`
- Modify: `web/src/lib/server/database/billing-order-repository.test.ts`
- Modify: `web/src/lib/server/billing-commerce-service.ts`
- Modify: `web/src/lib/server/billing-commerce-service.test.ts`
- Modify: `web/src/app/api/billing/orders/route.ts`
- Modify: `web/src/app/api/billing/orders/[id]/checkout/route.ts`
- Modify: `web/src/app/api/billing/orders/[id]/checkout/route.test.ts`

- [ ] **Step 1: Write collection-mode tests**

Cover:

- Platform collection selects the enabled platform merchant.
- Tenant collection selects the current tenant's merchant.
- Missing tenant merchant returns HTTP `409` with `{ code: 409, data: null, msg: "Merchant account is not configured." }` and records internal reason `MERCHANT_ACCOUNT_NOT_CONFIGURED`.
- Existing default-tenant orders select the migrated platform merchant.
- A user cannot checkout an order from another tenant.

- [ ] **Step 2: Extend checkout options**

```ts
export type CreatePaymentCheckoutOptions = {
    origin?: string;
    provider?: unknown;
    userId?: string;
    tenantId?: string;
    merchantAccountId?: string;
    collectionMode?: "platform" | "tenant";
};
```

- [ ] **Step 3: Persist the commercial snapshot at order creation**

Store:

```ts
type CommercialOrderSnapshot = {
    tenantId: string;
    collectionMode: "platform" | "tenant";
    merchantAccountId: string;
    beneficiaryType: "platform" | "tenant";
    currency: string;
    tenantSaleAmount: number;
    platformCostAmount: number;
    product: { id: string; name: string };
};
```

The checkout endpoint must use this snapshot and reject attempts to override merchant or collection mode in the request body.

- [ ] **Step 4: Inject decrypted merchant configuration server-side**

Provider adapters receive a `ResolvedMerchantAccount` from the service. Do not add credentials to `PaymentCheckoutResult`.

- [ ] **Step 5: Run tests and commit**

```powershell
pnpm test -- src/lib/server/payment-checkout-service.test.ts src/lib/server/database/billing-order-repository.test.ts src/lib/server/billing-commerce-service.test.ts src/app/api/billing/orders
git add web/src/lib/server/payment-checkout-types.ts web/src/lib/server/payment-checkout-service.ts web/src/lib/server/payment-checkout-service.test.ts web/src/lib/server/payment-checkout-providers.ts web/src/lib/server/database/billing-order-repository.ts web/src/lib/server/database/billing-order-repository.test.ts web/src/lib/server/billing-commerce-service.ts web/src/lib/server/billing-commerce-service.test.ts web/src/app/api/billing/orders
git commit -m "feat: make checkout merchant aware"
```

---

## Task 7: Resolve Webhooks by Merchant Identity

**Files:**

- Modify: `web/src/app/api/billing/webhooks/[provider]/route.ts`
- Create: `web/src/app/api/billing/webhooks/[provider]/route.test.ts`
- Modify: `web/src/lib/server/payment-webhook-service.ts`
- Modify: `web/src/lib/server/payment-webhook-service.test.ts`
- Modify: `web/src/lib/server/payment-webhook-adapters.ts`
- Modify: `web/src/lib/server/payment-webhook-adapters.test.ts`
- Modify: `web/src/lib/server/database/billing-payment-repository.ts`

- [ ] **Step 1: Write merchant-resolution tests**

Test valid platform and tenant callbacks, unknown merchant identity, valid signature from the wrong merchant, replayed event, and tenant ID spoofing in callback payload.

- [ ] **Step 2: Add a two-stage adapter contract**

```ts
export interface MerchantAwareWebhookAdapter {
    identifyMerchant(request: Request): Promise<{
        provider: string;
        environment: "test" | "production";
        webhookIdentity: string;
    }>;
    verifyAndParse(request: Request, merchant: ResolvedMerchantAccount): Promise<VerifiedPaymentEvent>;
}
```

- [ ] **Step 3: Implement secure resolution order**

1. Extract provider-controlled merchant identity.
2. Load the enabled merchant account.
3. Verify the signature using that merchant's credentials.
4. Load the order by provider order ID plus merchant account ID.
5. Confirm order tenant and merchant lineage.
6. Apply the payment event idempotently.

Ignore tenant IDs contained in untrusted callback payload fields.

- [ ] **Step 4: Credit the correct accounts**

- Platform collection: fulfill user entitlement and append tenant settlement receivable.
- Tenant collection: fulfill user entitlement only; do not credit tenant settlement.

- [ ] **Step 5: Run tests and commit**

```powershell
pnpm test -- src/lib/server/payment-webhook-service.test.ts src/lib/server/payment-webhook-adapters.test.ts src/app/api/billing/webhooks
git add web/src/app/api/billing/webhooks web/src/lib/server/payment-webhook-service.ts web/src/lib/server/payment-webhook-service.test.ts web/src/lib/server/payment-webhook-adapters.ts web/src/lib/server/payment-webhook-adapters.test.ts web/src/lib/server/database/billing-payment-repository.ts
git commit -m "feat: scope payment webhooks by merchant"
```

---

## Task 8: Make Refund and Reconciliation Tenant-Aware

**Files:**

- Modify: `web/src/lib/server/payment-refund-service.ts`
- Modify: `web/src/lib/server/payment-refund-service.test.ts`
- Modify: `web/src/lib/server/billing-refund-orchestration-service.ts`
- Modify: `web/src/lib/server/billing-refund-finalization-service.ts`
- Modify: `web/src/lib/server/payment-reconciliation-service.ts`
- Modify: `web/src/lib/server/payment-reconciliation-service.test.ts`
- Modify: `web/src/app/api/admin/billing/reconciliation/route.ts`
- Create: `web/src/app/api/tenant/billing/reconciliation/route.ts`
- Create: `web/src/app/api/tenant/billing/reconciliation/route.test.ts`

- [ ] **Step 1: Write refund matrix tests**

Cover full and partial refunds for both collection modes:

| Mode | Provider refund merchant | User entitlement | Tenant settlement |
|---|---|---|---|
| platform | platform | reverse proportional value | reverse receivable |
| tenant | tenant | reverse proportional value | unchanged |

Also test duplicate provider callbacks and retry after transient provider failure.

- [ ] **Step 2: Route refunds through the order merchant**

The refund service loads `merchant_account_id` from the order and decrypts only that account's credentials. An API caller cannot choose another merchant.

- [ ] **Step 3: Append reversal entries**

Never update historical ledger entries. Use `reversal_of_id` and a deterministic idempotency key based on refund ID and ledger type.

- [ ] **Step 4: Scope reconciliation**

Platform administrators may reconcile all merchants. Tenant administrators may reconcile only their own merchants and orders. Reports group by `tenant_id`, `merchant_account_id`, currency, and collection mode.

- [ ] **Step 5: Run tests and commit**

```powershell
pnpm test -- src/lib/server/payment-refund-service.test.ts src/lib/server/payment-reconciliation-service.test.ts src/app/api/tenant/billing/reconciliation
git add web/src/lib/server/payment-refund-service.ts web/src/lib/server/payment-refund-service.test.ts web/src/lib/server/billing-refund-orchestration-service.ts web/src/lib/server/billing-refund-finalization-service.ts web/src/lib/server/payment-reconciliation-service.ts web/src/lib/server/payment-reconciliation-service.test.ts web/src/app/api/admin/billing/reconciliation/route.ts web/src/app/api/tenant/billing/reconciliation
git commit -m "feat: add tenant aware refunds and reconciliation"
```

---

## Task 9: Add Billing Administration and Phase Verification

**Files:**

- Create: `web/src/app/tenant-admin/billing/page.tsx`
- Create: `web/src/app/tenant-admin/billing/components/tenant-billing-client.tsx`
- Create: `web/src/services/api/tenant-billing.ts`
- Create: `web/src/services/api/tenant-billing.test.ts`
- Modify: `web/src/app/admin/page.tsx`
- Modify: `web/src/app/tenant-admin/page.tsx`
- Create: `web/e2e/saas-billing-payment.spec.ts`
- Modify: `.env.example`

- [ ] **Step 1: Build tenant billing views**

Provide tabs for `Wallets`, `Power`, `Settlement`, `Orders`, `Merchants`, and `Reconciliation`. Display amounts with explicit currency/unit labels. Use masked merchant status fields and explicit test/production badges.

- [ ] **Step 2: Add E2E scenarios**

Verify:

1. Platform collection creates a platform-merchant order, credits user value, and adds tenant settlement receivable.
2. Tenant collection creates a tenant-merchant order, credits user value, and leaves platform settlement unchanged.
3. A successful app task settles user sale and platform cost exactly once.
4. A failed task releases both reservations.
5. A refund reverses the correct ledger entries.
6. Cross-tenant account and merchant access returns `404` or `403` without leaking existence.

- [ ] **Step 3: Document environment requirements**

Add non-secret variable names:

```dotenv
VOZEB_PRO_SAAS_BILLING_ENABLED=false
PAYMENT_CONFIG_MASTER_KEY=
```

Document that the master key is required before merchant migration and must be backed up outside the database.

- [ ] **Step 4: Run phase verification**

```powershell
pnpm test -- src/lib/server/billing src/lib/server/payment src/lib/server/payment-checkout-service.test.ts src/lib/server/payment-webhook-service.test.ts src/lib/server/payment-refund-service.test.ts
pnpm e2e -- saas-billing-payment.spec.ts
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits with code `0`.

- [ ] **Step 5: Commit**

```powershell
git add web/src/app/tenant-admin/billing web/src/services/api/tenant-billing.ts web/src/services/api/tenant-billing.test.ts web/src/app/admin/page.tsx web/src/app/tenant-admin/page.tsx web/e2e/saas-billing-payment.spec.ts .env.example
git commit -m "feat: add tenant billing administration"
```

## Exit Criteria

- User sale, platform cost, and platform-collection settlement are independently auditable.
- Task reserve/settle/release/reverse operations are atomic and idempotent.
- Platform and tenant merchant accounts both use the existing order lifecycle.
- Webhooks resolve and verify merchant ownership before loading tenant data.
- Refunds and reconciliation operate on the correct merchant and append reversals.
- Existing default-tenant payment and points tests remain green.
