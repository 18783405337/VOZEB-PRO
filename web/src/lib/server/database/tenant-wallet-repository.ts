import type { QueryExecutor } from "@/lib/server/database/postgres";

import { TenantLedgerRepository, type TenantLedgerTransactionRunner } from "./tenant-ledger-repository";

export class TenantWalletRepository extends TenantLedgerRepository {
    constructor(db: QueryExecutor, transaction?: TenantLedgerTransactionRunner) {
        super(
            db,
            {
                accountTable: "tenant_user_wallets",
                ledgerTable: "tenant_user_wallet_ledger_entries",
            },
            transaction,
        );
    }

    async getOrCreateAccount(input: { tenantId: string; userId: string; currency: string; now?: number }) {
        return this.ensureAccount({
            tenantId: input.tenantId,
            identityWhere: "user_id = $2 AND currency = $3",
            identityValues: [input.userId, input.currency],
            insertColumns: ["user_id", "currency"],
            insertValues: [input.userId, input.currency],
            now: input.now,
        });
    }
}
