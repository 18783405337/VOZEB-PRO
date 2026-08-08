import type { QueryExecutor } from "@/lib/server/database/postgres";

import { TenantLedgerRepository, type TenantLedgerTransactionRunner } from "./tenant-ledger-repository";

export class TenantSettlementRepository extends TenantLedgerRepository {
    constructor(db: QueryExecutor, transaction?: TenantLedgerTransactionRunner) {
        super(
            db,
            {
                accountTable: "tenant_settlement_accounts",
                ledgerTable: "tenant_settlement_ledger_entries",
            },
            transaction,
        );
    }

    async getOrCreateAccount(input: { tenantId: string; currency: string; now?: number }) {
        return this.ensureAccount({
            tenantId: input.tenantId,
            identityWhere: "currency = $2",
            identityValues: [input.currency],
            insertColumns: ["currency"],
            insertValues: [input.currency],
            now: input.now,
        });
    }
}
