# VOZEB-PRO DQAIGC Foundation Merge Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve VOZEB-PRO into a tenant-aware SaaS platform and migrate the reusable business capabilities of DQAIGC without retaining a second runtime.

**Architecture:** VOZEB-PRO remains the only write-side application, PostgreSQL remains the system of record, and existing Generation Worker, media, model routing, billing, and payment adapters remain the runtime foundation. The work is split into four independently reviewable implementation plans so each stage produces working, testable software.

**Tech Stack:** Next.js 16.2.12, React 19.2.8, TypeScript 5, PostgreSQL 14+, Vitest 4.1.10, Playwright 1.62.1, Ant Design 6.5.3, Tailwind CSS 4.

## Global Constraints

- Main project is `D:\homeWork\saas-api\VOZEB-PRO`; DQAIGC is a business-rule and migration-data source only.
- PostgreSQL is required for all SaaS features; file-provider mode must return a clear `501` response for SaaS administration APIs.
- Keep global `users` identities and model tenant membership through `tenant_members`.
- Public clients must never select a tenant by sending an arbitrary tenant ID header.
- Every tenant-owned root resource query must include `tenant_id`.
- Existing VOZEB data is backfilled into the fixed `default` tenant before non-null constraints are enabled.
- New APIs return `{ code, data, msg }` and use semantic HTTP status codes.
- User sale records, platform cost records, and platform-collection settlement records are separate immutable ledgers.
- Both `platform` and `tenant` collection modes use the same order lifecycle.
- Worker retries, request retries, and webhook replays must not duplicate charges.
- Payment and provider secrets stay encrypted and never appear in browser payloads or ordinary logs.
- Implement with TDD and commit after every task.
- Do not migrate all 24 DQAIGC applications in the MVP.

---

## Plan Set

1. [Tenant Kernel and Authorization](./2026-08-07-tenant-kernel-authorization.md)
2. [Application Center and AI Runtime](./2026-08-07-application-center-ai-runtime.md)
3. [Billing, Power, and Payment Hub](./2026-08-07-billing-power-payment-hub.md)
4. [Pilot Apps, Migration, and Rollout](./2026-08-07-pilot-apps-migration-rollout.md)

## Dependency Order

```text
Plan 1: Tenant Kernel and Authorization
  -> Plan 2: Application Center and AI Runtime
      -> Plan 3: Billing, Power, and Payment Hub
          -> Plan 4: Pilot Apps, Migration, and Rollout
```

Plan 2 may begin after Plan 1 Task 5 establishes stable tenant and authorization interfaces. Plan 3 may begin after Plan 2 Task 4 establishes generation pricing snapshots. Plan 4 begins after the task-billing settlement API and merchant-scoped checkout API are stable.

## Estimated Schedule

For a team of three to five engineers:

| Phase | Scope | Estimate |
| --- | --- | --- |
| Plan 1 | Tenant kernel, authorization, default-tenant safety | 4-5 weeks |
| Plan 2 | Application center and AI runtime | 3-4 weeks |
| Plan 3 | Double-sided billing and merchant-aware payments | 4-5 weeks |
| Plan 4 | Three pilot apps, migration tooling, rehearsal, rollout | 5-7 weeks |

Expected MVP duration is 16-21 weeks when backend, frontend, QA, and migration work can overlap. With two engineers, use a 6-8 month planning range and keep the same release gates.

## Program Milestones

### Milestone A: Default Tenant Safety

Exit criteria:

- Existing VOZEB records are assigned to `default`.
- Tenant context resolves from verified host, subdomain, or `/t/{slug}`.
- Cross-tenant repository tests prove reads and writes are isolated.
- Existing single-tenant user workflows still pass.

### Milestone B: Tenant Administration

Exit criteria:

- Platform admins can create and disable tenants.
- Tenant owners can manage members and roles.
- Platform and tenant permissions use different namespaces.
- `/admin` remains platform-only and `/tenant-admin` is tenant-scoped.

### Milestone C: Application Platform

Exit criteria:

- Platform admins publish versioned app definitions.
- Tenants install, enable, configure, authorize, and price apps.
- App submissions create tenant-scoped Generation Tasks with immutable app and pricing snapshots.
- Generic and custom-renderer app pages share the same server authorization.

### Milestone D: Commercial Settlement

Exit criteria:

- User wallet, tenant power, and tenant settlement accounts are separate.
- Generation tasks reserve, settle, release, and reverse both sides idempotently.
- Platform and tenant merchant accounts can both create checkout sessions.
- Webhooks resolve merchant ownership before resolving the tenant.

### Milestone E: MVP Release

Exit criteria:

- Background removal, product image, and product promo video run through the app runtime.
- DQAIGC tenant configuration can be imported through a dry-run-capable tool.
- One production tenant completes a rehearsal and a controlled cutover.
- Security, reconciliation, disaster backup, typecheck, unit, integration, and E2E gates pass.

## Release Gates

Run from `D:\homeWork\saas-api\VOZEB-PRO\web`:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm e2e
pnpm build
```

Expected result: every command exits with code `0`.

Database-specific integration tests run with an isolated PostgreSQL database:

```powershell
$env:DATABASE_URL='postgres://vozeb:vozeb@127.0.0.1:5432/vozeb_saas_test'
$env:VOZEB_PRO_DATABASE_PROVIDER='postgres'
pnpm test -- src/lib/server/database
```

Expected result: all PostgreSQL repository and schema lifecycle tests pass without using production data.

## Delivery Rhythm

- Complete and review one task before starting the next task in the same plan.
- Merge one plan only after its exit criteria pass.
- Keep unfinished features behind `VOZEB_PRO_SAAS_ENABLED=false`.
- Enable the flag first for internal and named tenant IDs, then for all new tenants.
- Never run a production backfill without a dry run, row-count reconciliation, and a current disaster backup.
