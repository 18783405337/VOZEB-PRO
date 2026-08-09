import { createPostgresRepositories } from "@/lib/server/database";
import { createPostgresTaskBillingService } from "@/lib/server/billing/task-billing-service";

export async function reserveSmartClipBilling(input: Readonly<{ tenantId: string; userId: string; taskId: string; quantity: number; tenantCostPoints: number; userChargePoints: number; clipType: string; provider: string; model: string }>) {
    const repositories = createPostgresRepositories();
    const [wallet, power] = await Promise.all([
        repositories.tenantWallet.getOrCreateAccount({ tenantId: input.tenantId, userId: input.userId, currency: "points" }),
        repositories.tenantPower.getOrCreateAccount({ tenantId: input.tenantId, unit: "points" }),
    ]);
    return createPostgresTaskBillingService().reserve({
        tenantId: input.tenantId,
        generationTaskId: input.taskId,
        userId: input.userId,
        walletAccountId: wallet.id,
        powerAccountId: power.id,
        saleAmount: input.userChargePoints,
        costAmount: input.tenantCostPoints,
        idempotencyKey: `smart-clip:${input.taskId}:reserve`,
        snapshot: {
            tenantId: input.tenantId,
            generationTaskId: input.taskId,
            userId: input.userId,
            clipType: input.clipType,
            provider: input.provider,
            model: input.model,
            quantity: input.quantity,
            saleAmount: input.userChargePoints,
            costAmount: input.tenantCostPoints,
        },
    });
}
