import type { TenantAppDetails } from "@/lib/server/database/app-center-repository";
import { createPostgresRepositories } from "@/lib/server/database";
import type { ResolvedLogicalModel } from "@/lib/server/logical-model-router";

import { createTenantAppTaskBillingPort, type AppTaskBillingPort } from "./tenant-app-runtime";

type BillingAccount = Readonly<{ id: string }>;

export type SpecializedTaskBillingDependencies = Readonly<{
    accounts: Readonly<{
        wallet: Readonly<{
            getOrCreateAccount(input: { tenantId: string; userId: string; currency: string }): Promise<BillingAccount>;
        }>;
        power: Readonly<{
            getOrCreateAccount(input: { tenantId: string; unit: string }): Promise<BillingAccount>;
        }>;
    }>;
    billing: Pick<AppTaskBillingPort, "reserve" | "release">;
}>;

export type SpecializedTaskBillingReservation = Readonly<{
    saleAmount: number;
    costAmount: number;
    snapshot: Record<string, unknown>;
}>;

export async function reserveSpecializedTaskBilling(
    input: Readonly<{
        tenantId: string;
        userId: string;
        generationTaskId: string;
        tenantApp: TenantAppDetails;
        candidate: ResolvedLogicalModel;
        quantity: number;
    }>,
    dependencies = createDefaultDependencies(),
): Promise<SpecializedTaskBillingReservation> {
    const quantity = positiveSafeInteger(input.quantity, "Billing quantity");
    const pricing = input.tenantApp.pricing || {
        ...input.tenantApp.definition.defaultPricing,
        collectionMode: "platform" as const,
    };
    const saleUnitAmount = nonNegativeSafeInteger(pricing.saleAmount, "Application sale amount");
    const costUnitAmount = nonNegativeNumber(input.candidate.capabilityProfile?.unitCost, "Provider unit cost");
    const saleAmount = safeTotal(saleUnitAmount, quantity, "Application sale total");
    const costAmount = safeTotal(costUnitAmount, quantity, "Provider cost total");
    const costUnit = cleanText(input.candidate.capabilityProfile?.unitCostCurrency) || pricing.currency;

    const [walletAccount, powerAccount] = await Promise.all([
        dependencies.accounts.wallet.getOrCreateAccount({
            tenantId: input.tenantId,
            userId: input.userId,
            currency: pricing.currency,
        }),
        dependencies.accounts.power.getOrCreateAccount({
            tenantId: input.tenantId,
            unit: costUnit,
        }),
    ]);

    const snapshot = {
        tenantId: input.tenantId,
        generationTaskId: input.generationTaskId,
        userId: input.userId,
        appKey: input.tenantApp.appKey,
        appVersion: input.tenantApp.version,
        workflowKey: input.tenantApp.definition.workflowKey,
        billingMetric: input.tenantApp.definition.billingMetric,
        collectionMode: pricing.collectionMode,
        logicalModelKey: input.candidate.logicalModelId,
        upstreamModel: input.candidate.upstreamModel,
        salePricing: {
            currency: pricing.currency,
            unit: pricing.saleUnit,
            amount: saleUnitAmount,
            quantity,
            total: saleAmount,
        },
        costPricing: {
            unit: costUnit,
            amount: costUnitAmount,
            quantity,
            total: costAmount,
        },
    };

    await dependencies.billing.reserve({
        tenantId: input.tenantId,
        generationTaskId: input.generationTaskId,
        userId: input.userId,
        walletAccountId: walletAccount.id,
        powerAccountId: powerAccount.id,
        saleAmount,
        costAmount,
        idempotencyKey: reserveIdempotencyKey(input.generationTaskId),
        snapshot,
    });

    return { saleAmount, costAmount, snapshot };
}

export async function releaseSpecializedTaskBilling(
    input: Readonly<{ tenantId: string; generationTaskId: string }>,
    dependencies = createDefaultDependencies(),
) {
    return dependencies.billing.release({
        tenantId: input.tenantId,
        generationTaskId: input.generationTaskId,
        idempotencyKey: releaseIdempotencyKey(input.generationTaskId),
    });
}

function createDefaultDependencies(): SpecializedTaskBillingDependencies {
    const repositories = createPostgresRepositories();
    return {
        accounts: {
            wallet: repositories.tenantWallet,
            power: repositories.tenantPower,
        },
        billing: createTenantAppTaskBillingPort(),
    };
}

function reserveIdempotencyKey(taskId: string) {
    return `specialized-task-billing:${taskId}:reserve`;
}

function releaseIdempotencyKey(taskId: string) {
    return `specialized-task-billing:${taskId}:release`;
}

function cleanText(value: unknown) {
    return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function positiveSafeInteger(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${field} must be a positive safe integer`);
    return number;
}

function nonNegativeSafeInteger(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${field} must be a non-negative safe integer`);
    return number;
}

function nonNegativeNumber(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return 0;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error(`${field} must be a non-negative number`);
    return number;
}

function safeTotal(unitAmount: number, quantity: number, field: string) {
    const total = Math.ceil(unitAmount * quantity);
    if (!Number.isSafeInteger(total) || total < 0) throw new Error(`${field} must be a non-negative safe integer`);
    return total;
}
