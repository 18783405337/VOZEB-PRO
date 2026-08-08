import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const databaseUrl = process.env.VOZEB_PRO_E2E_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
const adminUsername = "e2e_admin";
const e2eEncryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test.describe("saas billing payment chain", () => {
    test.skip(!databaseUrl, "VOZEB_PRO_E2E_DATABASE_URL or DATABASE_URL is required for SaaS billing E2E");

    let createPostgresRepositories: typeof import("../src/lib/server/database").createPostgresRepositories;
    let ensurePostgresSchema: typeof import("../src/lib/server/database").ensurePostgresSchema;
    let upsertBillingProduct: typeof import("../src/lib/server/billing-service").upsertBillingProduct;
    let createBillingOrder: typeof import("../src/lib/server/billing-service").createBillingOrder;
    let completeBillingOrderPayment: typeof import("../src/lib/server/billing-service").completeBillingOrderPayment;
    let refundBillingOrder: typeof import("../src/lib/server/billing-service").refundBillingOrder;
    let createPostgresTaskBillingService: typeof import("../src/lib/server/billing/task-billing-service").createPostgresTaskBillingService;
    let MerchantAccountService: typeof import("../src/lib/server/payment/merchant-account-service").MerchantAccountService;

    let repos: ReturnType<typeof import("../src/lib/server/database").createPostgresRepositories>;
    let admin: { id: string; username: string; pointsBalance: number };
    let product: { id: string; amountCents: number; pointsAmount: number };
    let platformTenantId: string;
    let tenantCollectionId: string;
    let taskTenantId: string;
    let refundTenantId: string;
    let tenantMerchantId: string;

    test.beforeAll(async () => {
        process.env.VOZEB_PRO_DATABASE_PROVIDER = "postgres";
        process.env.DATABASE_URL = databaseUrl;
        process.env.VOZEB_PRO_ENCRYPTION_KEY = process.env.VOZEB_PRO_ENCRYPTION_KEY || e2eEncryptionKey;
        process.env.VOZEB_PRO_PAYMENT_ENVIRONMENT = "production";
        process.env.VOZEB_PRO_SAAS_BILLING_ENABLED = process.env.VOZEB_PRO_SAAS_BILLING_ENABLED || "1";

        const database = await import("../src/lib/server/database");
        const billing = await import("../src/lib/server/billing-service");
        const taskBilling = await import("../src/lib/server/billing/task-billing-service");
        const merchantAccounts = await import("../src/lib/server/payment/merchant-account-service");

        createPostgresRepositories = database.createPostgresRepositories;
        ensurePostgresSchema = database.ensurePostgresSchema;
        upsertBillingProduct = billing.upsertBillingProduct;
        createBillingOrder = billing.createBillingOrder;
        completeBillingOrderPayment = billing.completeBillingOrderPayment;
        refundBillingOrder = billing.refundBillingOrder;
        createPostgresTaskBillingService = taskBilling.createPostgresTaskBillingService;
        MerchantAccountService = merchantAccounts.MerchantAccountService;

        await ensurePostgresSchema();

        repos = createPostgresRepositories();
        const user = await repos.users.getByUsername(adminUsername);
        if (!user) throw new Error(`Missing seeded admin user: ${adminUsername}`);
        admin = { id: user.id, username: user.username, pointsBalance: user.pointsBalance };

        product = await upsertBillingProduct({
            id: `e2e-points-${randomUUID()}`,
            productKind: "points",
            name: `E2E Points ${randomUUID()}`,
            description: "SaaS billing E2E product",
            amountCents: 990,
            currency: "CNY",
            pointsAmount: 500,
            dailyPoints: 0,
            periodDays: 0,
            enabled: true,
            sortOrder: 0,
            metadata: { e2e: true },
        });

        platformTenantId = `e2e-platform-${randomUUID()}`;
        tenantCollectionId = `e2e-tenant-collection-${randomUUID()}`;
        taskTenantId = `e2e-task-${randomUUID()}`;
        refundTenantId = `e2e-refund-${randomUUID()}`;

        const merchantService = new MerchantAccountService(repos.merchantAccounts);
        const tenantMerchant = await merchantService.save(
            { ownerType: "tenant", ownerId: tenantCollectionId, tenantId: tenantCollectionId },
            {
                provider: "manual",
                environment: "production",
                credentials: {},
                webhookIdentity: `e2e-tenant-manual-${randomUUID()}`,
            },
        );
        tenantMerchantId = tenantMerchant.id;
    });

    test("platform collection credits points and settlement exactly once", async () => {
        const settlementBefore = await repos.tenantSettlement.getOrCreateAccount({ tenantId: platformTenantId, currency: "CNY" });
        const pointsBefore = (await repos.users.getById(admin.id))!.pointsBalance;

        const order = await createBillingOrder({
            userId: admin.id,
            tenantId: platformTenantId,
            productId: product.id,
            quantity: 1,
            provider: "manual",
            collectionMode: "platform",
        });
        const tradeId = `trade-platform-${randomUUID()}`;

        const first = await completeBillingOrderPayment({ orderId: order.id, providerTradeId: tradeId, paidAt: new Date().toISOString() });
        const duplicate = await completeBillingOrderPayment({ orderId: order.id, providerTradeId: tradeId, paidAt: new Date().toISOString() });

        const settlementAfter = await repos.tenantSettlement.getOrCreateAccount({ tenantId: platformTenantId, currency: "CNY" });
        const pointsAfter = (await repos.users.getById(admin.id))!.pointsBalance;

        expect(first.order).toMatchObject({ status: "paid", collectionMode: "platform", tenantId: platformTenantId });
        expect(duplicate.order).toMatchObject({ status: "paid" });
        expect(duplicate.pointsGranted).toBe(0);
        expect(pointsAfter - pointsBefore).toBe(product.pointsAmount);
        expect(settlementAfter.availableAmount - settlementBefore.availableAmount).toBe(order.amountCents);
    });

    test("tenant collection skips platform settlement while still crediting points", async () => {
        const settlementBefore = await repos.tenantSettlement.getOrCreateAccount({ tenantId: tenantCollectionId, currency: "CNY" });
        const pointsBefore = (await repos.users.getById(admin.id))!.pointsBalance;

        const order = await createBillingOrder({
            userId: admin.id,
            tenantId: tenantCollectionId,
            productId: product.id,
            provider: "manual",
            collectionMode: "tenant",
        });
        const tradeId = `trade-tenant-${randomUUID()}`;

        const payment = await completeBillingOrderPayment({ orderId: order.id, providerTradeId: tradeId, paidAt: new Date().toISOString() });
        const settlementAfter = await repos.tenantSettlement.getOrCreateAccount({ tenantId: tenantCollectionId, currency: "CNY" });
        const pointsAfter = (await repos.users.getById(admin.id))!.pointsBalance;

        expect(order).toMatchObject({ collectionMode: "tenant" });
        expect(payment.order).toMatchObject({ status: "paid", collectionMode: "tenant", merchantAccountId: tenantMerchantId });
        expect(pointsAfter - pointsBefore).toBe(product.pointsAmount);
        expect(settlementAfter.availableAmount).toBe(settlementBefore.availableAmount);
    });

    test("task billing settles and replays without double counting", async () => {
        const taskBilling = createPostgresTaskBillingService();
        const wallet = await repos.tenantWallet.getOrCreateAccount({ tenantId: taskTenantId, userId: admin.id, currency: "CNY" });
        const power = await repos.tenantPower.getOrCreateAccount({ tenantId: taskTenantId, unit: "image" });
        await repos.tenantWallet.credit({
            tenantId: taskTenantId,
            accountId: wallet.id,
            amount: 1_000,
            referenceType: "seed",
            referenceId: `wallet-seed-${randomUUID()}`,
            idempotencyKey: `wallet-seed-${randomUUID()}`,
        });
        await repos.tenantPower.credit({
            tenantId: taskTenantId,
            accountId: power.id,
            amount: 500,
            referenceType: "seed",
            referenceId: `power-seed-${randomUUID()}`,
            idempotencyKey: `power-seed-${randomUUID()}`,
        });

        const reserve = await taskBilling.reserve({
            tenantId: taskTenantId,
            generationTaskId: `task-${randomUUID()}`,
            userId: admin.id,
            walletAccountId: wallet.id,
            powerAccountId: power.id,
            saleAmount: 120,
            costAmount: 45,
            idempotencyKey: `task-reserve-${randomUUID()}`,
            snapshot: { scenario: "reserve", tenantId: taskTenantId },
        });
        expect(reserve).toMatchObject({ status: "reserved", saleReserved: 120, costReserved: 45 });

        const reservedWallet = await repos.tenantWallet.getOrCreateAccount({ tenantId: taskTenantId, userId: admin.id, currency: "CNY" });
        const reservedPower = await repos.tenantPower.getOrCreateAccount({ tenantId: taskTenantId, unit: "image" });
        expect(reservedWallet).toMatchObject({ availableAmount: 880, reservedAmount: 120 });
        expect(reservedPower).toMatchObject({ availableAmount: 455, reservedAmount: 45 });

        const settled = await taskBilling.settle({
            tenantId: taskTenantId,
            generationTaskId: reserve.generationTaskId,
            idempotencyKey: `task-settle-${randomUUID()}`,
            actualSaleAmount: 120,
            actualCostAmount: 45,
        });
        const replay = await taskBilling.settle({
            tenantId: taskTenantId,
            generationTaskId: reserve.generationTaskId,
            idempotencyKey: `task-settle-${randomUUID()}`,
            actualSaleAmount: 120,
            actualCostAmount: 45,
        });

        const settledWallet = await repos.tenantWallet.getOrCreateAccount({ tenantId: taskTenantId, userId: admin.id, currency: "CNY" });
        const settledPower = await repos.tenantPower.getOrCreateAccount({ tenantId: taskTenantId, unit: "image" });
        expect(settled).toMatchObject({ status: "settled", saleSettled: 120, costSettled: 45 });
        expect(replay).toMatchObject({ status: "settled" });
        expect(settledWallet).toMatchObject({ availableAmount: 880, reservedAmount: 0 });
        expect(settledPower).toMatchObject({ availableAmount: 455, reservedAmount: 0 });
    });

    test("task billing release restores both reservations once", async () => {
        const taskBilling = createPostgresTaskBillingService();
        const wallet = await repos.tenantWallet.getOrCreateAccount({ tenantId: `${taskTenantId}-release`, userId: admin.id, currency: "CNY" });
        const power = await repos.tenantPower.getOrCreateAccount({ tenantId: `${taskTenantId}-release`, unit: "video" });
        await repos.tenantWallet.credit({
            tenantId: `${taskTenantId}-release`,
            accountId: wallet.id,
            amount: 300,
            referenceType: "seed",
            referenceId: `wallet-seed-${randomUUID()}`,
            idempotencyKey: `wallet-seed-${randomUUID()}`,
        });
        await repos.tenantPower.credit({
            tenantId: `${taskTenantId}-release`,
            accountId: power.id,
            amount: 120,
            referenceType: "seed",
            referenceId: `power-seed-${randomUUID()}`,
            idempotencyKey: `power-seed-${randomUUID()}`,
        });

        const taskId = `task-${randomUUID()}`;
        await taskBilling.reserve({
            tenantId: `${taskTenantId}-release`,
            generationTaskId: taskId,
            userId: admin.id,
            walletAccountId: wallet.id,
            powerAccountId: power.id,
            saleAmount: 80,
            costAmount: 30,
            idempotencyKey: `task-reserve-${randomUUID()}`,
            snapshot: { scenario: "release", tenantId: taskTenantId },
        });
        const firstRelease = await taskBilling.release({ tenantId: `${taskTenantId}-release`, generationTaskId: taskId, idempotencyKey: `task-release-${randomUUID()}` });
        const replayRelease = await taskBilling.release({ tenantId: `${taskTenantId}-release`, generationTaskId: taskId, idempotencyKey: `task-release-${randomUUID()}` });

        const releasedWallet = await repos.tenantWallet.getOrCreateAccount({ tenantId: `${taskTenantId}-release`, userId: admin.id, currency: "CNY" });
        const releasedPower = await repos.tenantPower.getOrCreateAccount({ tenantId: `${taskTenantId}-release`, unit: "video" });
        expect(firstRelease).toMatchObject({ status: "released" });
        expect(replayRelease).toMatchObject({ status: "released" });
        expect(releasedWallet).toMatchObject({ availableAmount: 300, reservedAmount: 0 });
        expect(releasedPower).toMatchObject({ availableAmount: 120, reservedAmount: 0 });
    });

    test("refund reverses points and settlement once and keeps tenant isolation", async () => {
        const settlementBefore = await repos.tenantSettlement.getOrCreateAccount({ tenantId: refundTenantId, currency: "CNY" });
        const pointsBefore = (await repos.users.getById(admin.id))!.pointsBalance;

        const order = await createBillingOrder({
            userId: admin.id,
            tenantId: refundTenantId,
            productId: product.id,
            provider: "manual",
            collectionMode: "platform",
        });
        const tradeId = `trade-refund-${randomUUID()}`;
        await completeBillingOrderPayment({ orderId: order.id, providerTradeId: tradeId, paidAt: new Date().toISOString() });

        const firstRefundAmountCents = Math.max(1, Math.floor(order.amountCents / 2));
        const partial = await refundBillingOrder(order.id, {
            amountCents: firstRefundAmountCents,
            refundRequestId: `e2e-partial-${randomUUID()}`,
        });
        const partialReplay = await refundBillingOrder(order.id, {
            amountCents: firstRefundAmountCents,
            refundRequestId: partial.order.metadata && typeof partial.order.metadata === "object" && !Array.isArray(partial.order.metadata)
                ? String((partial.order.metadata as { refund?: { refundRequestId?: unknown } }).refund?.refundRequestId || "")
                : "",
        });
        const refunded = await refundBillingOrder(order.id, {
            amountCents: order.amountCents - firstRefundAmountCents,
            refundRequestId: `e2e-final-${randomUUID()}`,
        });
        const refundedAgain = await refundBillingOrder(order.id);
        const settlementAfter = await repos.tenantSettlement.getOrCreateAccount({ tenantId: refundTenantId, currency: "CNY" });
        const pointsAfter = (await repos.users.getById(admin.id))!.pointsBalance;

        expect(partial.order).toMatchObject({ status: "partially_refunded" });
        expect(partialReplay.order).toMatchObject({ status: "partially_refunded" });
        expect(refunded.order).toMatchObject({ status: "refunded" });
        expect(refunded.pointsReversed).toBe(product.pointsAmount);
        expect(refundedAgain.order).toMatchObject({ status: "refunded" });
        expect(pointsAfter).toBe(pointsBefore);
        expect(settlementAfter.availableAmount).toBe(settlementBefore.availableAmount);

        const merchantService = new MerchantAccountService(repos.merchantAccounts);
        await expect(merchantService.disable({ ownerType: "tenant", ownerId: `${tenantCollectionId}-other`, tenantId: `${tenantCollectionId}-other` }, tenantMerchantId)).rejects.toMatchObject({ status: 404 });
        const wrongTenantCredit = repos.tenantWallet.credit({
            tenantId: `${taskTenantId}-isolation`,
            accountId: (await repos.tenantWallet.getOrCreateAccount({ tenantId: `${taskTenantId}-isolation-a`, userId: admin.id, currency: "CNY" })).id,
            amount: 10,
            referenceType: "seed",
            referenceId: `isolation-${randomUUID()}`,
            idempotencyKey: `isolation-${randomUUID()}`,
        });
        await expect(wrongTenantCredit).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    });
});
