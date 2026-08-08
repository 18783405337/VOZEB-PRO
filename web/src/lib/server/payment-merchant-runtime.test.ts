import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getPaymentRuntimeConfig: vi.fn(),
    bootstrapLegacyPaymentMerchantAccounts: vi.fn(),
    resolveForCheckout: vi.fn(),
    resolveForWebhook: vi.fn(),
}));

vi.mock("@/lib/server/payment-config-store", () => ({
    getPaymentRuntimeConfig: mocks.getPaymentRuntimeConfig,
    bootstrapLegacyPaymentMerchantAccounts: mocks.bootstrapLegacyPaymentMerchantAccounts,
    buildPaymentRuntimeConfigFromMerchant: (merchant: { provider: string; credentials: Record<string, string> }) => ({
        saved: { providers: { [merchant.provider]: { enabled: true, values: merchant.credentials } } },
        valuesByEnvName: merchant.credentials,
        providers: { [merchant.provider]: { enabled: true, saved: true } },
    }),
    paymentMerchantEnvironment: () => "production",
}));

vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: () => ({ merchantAccounts: {} }),
}));

vi.mock("@/lib/server/payment/merchant-account-service", () => ({
    MerchantAccountService: class {
        resolveForCheckout = mocks.resolveForCheckout;
        resolveForWebhook = mocks.resolveForWebhook;
    },
}));

import { resolvePaymentMerchantRuntime, resolvePaymentWebhookMerchantRuntime } from "./payment-merchant-runtime";

describe("payment merchant runtime", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getPaymentRuntimeConfig.mockResolvedValue({
            saved: { providers: {} },
            valuesByEnvName: {},
            providers: { payply: { enabled: true, saved: true } },
        });
        mocks.bootstrapLegacyPaymentMerchantAccounts.mockResolvedValue([]);
    });

    it("resolves the merchant locked to the order and returns its runtime credentials", async () => {
        const merchant = {
            id: "merchant-tenant-a",
            ownerType: "tenant",
            ownerId: "tenant-a",
            tenantId: "tenant-a",
            provider: "payply",
            environment: "production",
            status: "enabled",
            webhookIdentity: "tenant-a-payply",
            encryptedConfig: "encrypted",
            configuredFields: ["apiKey"],
            credentials: { apiKey: "tenant-secret" },
            createdAt: 1,
            updatedAt: 1,
        };
        mocks.resolveForCheckout.mockResolvedValue(merchant);

        const result = await resolvePaymentMerchantRuntime({
            order: {
                id: "order-one",
                tenantId: "tenant-a",
                provider: "payply",
                merchantAccountId: "merchant-tenant-a",
                collectionMode: "tenant",
            },
            provider: "payply",
        });

        expect(result.merchant).toBe(merchant);
        expect(result.config.valuesByEnvName).toEqual({ apiKey: "tenant-secret" });
        expect(mocks.resolveForCheckout).toHaveBeenCalledWith({
            id: "merchant-tenant-a",
            scope: { ownerType: "tenant", ownerId: "tenant-a", tenantId: "tenant-a" },
            provider: "payply",
            environment: "production",
        });
    });

    it("rejects a tenant order whose merchant belongs to another tenant", async () => {
        mocks.resolveForCheckout.mockRejectedValue(new Error("Merchant account is not configured."));

        await expect(
            resolvePaymentMerchantRuntime({
                order: {
                    id: "order-one",
                    tenantId: "tenant-a",
                    provider: "payply",
                    merchantAccountId: "merchant-tenant-b",
                    collectionMode: "tenant",
                },
                provider: "payply",
            }),
        ).rejects.toThrow("Merchant account is not configured.");
    });

    it("resolves webhook credentials by the provider-controlled merchant identity", async () => {
        const merchant = {
            id: "merchant-tenant-a",
            provider: "payply",
            environment: "production",
            credentials: { apiKey: "tenant-webhook-secret" },
        };
        mocks.resolveForWebhook.mockResolvedValue(merchant);

        const result = await resolvePaymentWebhookMerchantRuntime({
            provider: "payply",
            environment: "production",
            webhookIdentity: "tenant-a-payply",
        });

        expect(result.merchant).toBe(merchant);
        expect(result.config.valuesByEnvName).toEqual({ apiKey: "tenant-webhook-secret" });
        expect(mocks.resolveForWebhook).toHaveBeenCalledWith({
            provider: "payply",
            environment: "production",
            webhookIdentity: "tenant-a-payply",
        });
    });
});
