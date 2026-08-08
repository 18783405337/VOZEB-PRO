export const POSTGRESQL_SAAS_BILLING_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tenant_user_wallets (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id),
    user_id text NOT NULL REFERENCES users(id),
    currency text NOT NULL,
    available_amount bigint NOT NULL DEFAULT 0,
    reserved_amount bigint NOT NULL DEFAULT 0,
    version bigint NOT NULL DEFAULT 0,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    UNIQUE (tenant_id, user_id, currency),
    CHECK (available_amount >= 0),
    CHECK (reserved_amount >= 0)
);

CREATE TABLE IF NOT EXISTS tenant_user_wallet_ledger_entries (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id),
    account_id text NOT NULL REFERENCES tenant_user_wallets(id),
    amount bigint NOT NULL CHECK (amount > 0),
    direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
    entry_type text NOT NULL,
    reference_type text NOT NULL,
    reference_id text NOT NULL,
    idempotency_key text NOT NULL,
    reversal_of_id text REFERENCES tenant_user_wallet_ledger_entries(id),
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at bigint NOT NULL,
    UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS tenant_user_wallet_ledger_reference_idx
ON tenant_user_wallet_ledger_entries (tenant_id, reference_type, reference_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_power_accounts (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id),
    unit text NOT NULL,
    available_amount bigint NOT NULL DEFAULT 0,
    reserved_amount bigint NOT NULL DEFAULT 0,
    version bigint NOT NULL DEFAULT 0,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    UNIQUE (tenant_id, unit),
    CHECK (available_amount >= 0),
    CHECK (reserved_amount >= 0)
);

CREATE TABLE IF NOT EXISTS tenant_power_ledger_entries (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id),
    account_id text NOT NULL REFERENCES tenant_power_accounts(id),
    amount bigint NOT NULL CHECK (amount > 0),
    direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
    entry_type text NOT NULL,
    reference_type text NOT NULL,
    reference_id text NOT NULL,
    idempotency_key text NOT NULL,
    reversal_of_id text REFERENCES tenant_power_ledger_entries(id),
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at bigint NOT NULL,
    UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS tenant_power_ledger_reference_idx
ON tenant_power_ledger_entries (tenant_id, reference_type, reference_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_settlement_accounts (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id),
    currency text NOT NULL,
    available_amount bigint NOT NULL DEFAULT 0,
    reserved_amount bigint NOT NULL DEFAULT 0,
    version bigint NOT NULL DEFAULT 0,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    UNIQUE (tenant_id, currency),
    CHECK (available_amount >= 0),
    CHECK (reserved_amount >= 0)
);

CREATE TABLE IF NOT EXISTS tenant_settlement_ledger_entries (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id),
    account_id text NOT NULL REFERENCES tenant_settlement_accounts(id),
    amount bigint NOT NULL CHECK (amount > 0),
    direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
    entry_type text NOT NULL,
    reference_type text NOT NULL,
    reference_id text NOT NULL,
    idempotency_key text NOT NULL,
    reversal_of_id text REFERENCES tenant_settlement_ledger_entries(id),
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at bigint NOT NULL,
    UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS tenant_settlement_ledger_reference_idx
ON tenant_settlement_ledger_entries (tenant_id, reference_type, reference_id, created_at DESC);

CREATE TABLE IF NOT EXISTS merchant_accounts (
    id text PRIMARY KEY,
    owner_type text NOT NULL CHECK (owner_type IN ('platform', 'tenant')),
    owner_id text NOT NULL,
    tenant_id text REFERENCES tenants(id),
    provider text NOT NULL,
    environment text NOT NULL CHECK (environment IN ('test', 'production')),
    status text NOT NULL CHECK (status IN ('enabled', 'disabled')),
    encrypted_config text NOT NULL,
    webhook_identity text NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    UNIQUE (provider, environment, webhook_identity),
    CHECK (
        (owner_type = 'platform' AND tenant_id IS NULL)
        OR (owner_type = 'tenant' AND tenant_id IS NOT NULL AND owner_id = tenant_id)
    )
);

CREATE INDEX IF NOT EXISTS merchant_accounts_owner_idx
ON merchant_accounts (owner_type, owner_id, provider, environment, status);

CREATE TABLE IF NOT EXISTS task_billing_reservations (
    id text PRIMARY KEY,
    tenant_id text NOT NULL REFERENCES tenants(id),
    generation_task_id text NOT NULL REFERENCES generation_tasks(id),
    user_wallet_id text NOT NULL REFERENCES tenant_user_wallets(id),
    power_account_id text NOT NULL REFERENCES tenant_power_accounts(id),
    sale_reserved bigint NOT NULL,
    cost_reserved bigint NOT NULL,
    sale_settled bigint NOT NULL DEFAULT 0,
    cost_settled bigint NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('reserved', 'settled', 'released', 'reversed')),
    idempotency_key text NOT NULL,
    snapshot_json jsonb NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    UNIQUE (tenant_id, generation_task_id),
    UNIQUE (tenant_id, idempotency_key),
    CHECK (sale_reserved >= 0 AND cost_reserved >= 0),
    CHECK (sale_settled >= 0 AND sale_settled <= sale_reserved),
    CHECK (cost_settled >= 0 AND cost_settled <= cost_reserved)
);

CREATE INDEX IF NOT EXISTS task_billing_reservations_status_idx
ON task_billing_reservations (tenant_id, status, updated_at DESC);

ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS collection_mode text;
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS merchant_account_id text REFERENCES merchant_accounts(id);
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS beneficiary_type text;
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS commercial_snapshot_json jsonb;

ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS merchant_account_id text REFERENCES merchant_accounts(id);

ALTER TABLE billing_refund_jobs ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
ALTER TABLE billing_refund_jobs ADD COLUMN IF NOT EXISTS merchant_account_id text REFERENCES merchant_accounts(id);
`;
