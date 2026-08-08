import type { QueryExecutor } from "@/lib/server/database/postgres";

import { TenantLedgerRepository, type TenantLedgerTransactionRunner } from "./tenant-ledger-repository";

export class TenantPowerRepository extends TenantLedgerRepository {
    constructor(db: QueryExecutor, transaction?: TenantLedgerTransactionRunner) {
        super(
            db,
            {
                accountTable: "tenant_power_accounts",
                ledgerTable: "tenant_power_ledger_entries",
            },
            transaction,
        );
    }

    async getOrCreateAccount(input: { tenantId: string; unit: string; now?: number }) {
        return this.ensureAccount({
            tenantId: input.tenantId,
            identityWhere: "unit = $2",
            identityValues: [input.unit],
            insertColumns: ["unit"],
            insertValues: [input.unit],
            now: input.now,
        });
    }
}
