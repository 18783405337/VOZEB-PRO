import { createPostgresRepositories, type BillingOrderRecord, type BillingReconciliationRunRecord } from "@/lib/server/database";
import type { PageResult } from "@/lib/server/database/repository-types";
import type { TenantAccountRecord } from "@/lib/server/database/tenant-ledger-repository";
import { MerchantAccountService, type MerchantAccountSummary } from "@/lib/server/payment/merchant-account-service";

export type TenantBillingOverview = {
    wallets: TenantAccountRecord[];
    power: TenantAccountRecord[];
    settlement: TenantAccountRecord[];
    orders: PageResult<BillingOrderRecord>;
    merchants: MerchantAccountSummary[];
    reconciliation: PageResult<BillingReconciliationRunRecord>;
    generatedAt: string;
};

export async function getTenantBillingOverview(tenantId: string): Promise<TenantBillingOverview> {
    const repositories = createPostgresRepositories();
    const merchantService = new MerchantAccountService(repositories.merchantAccounts);
    const [wallets, power, settlement, orders, merchants, reconciliation] = await Promise.all([
        repositories.tenantWallet.listAccounts(tenantId),
        repositories.tenantPower.listAccounts(tenantId),
        repositories.tenantSettlement.listAccounts(tenantId),
        repositories.billing.listOrders({ tenantId, page: 1, pageSize: 20 }),
        merchantService.list({ ownerType: "tenant", ownerId: tenantId, tenantId }),
        repositories.billing.listReconciliationRuns({ tenantId, page: 1, pageSize: 10 }),
    ]);

    return {
        wallets,
        power,
        settlement,
        orders,
        merchants,
        reconciliation,
        generatedAt: new Date().toISOString(),
    };
}
