import { describe, expect, it, vi } from "vitest";

import { bootstrapLegacyPaymentMerchantAccounts, isPaymentRuntimeProviderCheckoutReady, type PaymentRuntimeConfig } from "./payment-config-store";

describe("payment provider checkout readiness", () => {
    it("keeps manual checkout available without configuration", () => {
        expect(isPaymentRuntimeProviderCheckoutReady(config(), "manual")).toBe(true);
    });

    it("rejects an enabled provider with missing checkout credentials", () => {
        expect(isPaymentRuntimeProviderCheckoutReady(config({ stripe: { enabled: true, saved: true } }), "stripe")).toBe(false);
    });

    it("accepts an enabled provider with production checkout credentials", () => {
        expect(isPaymentRuntimeProviderCheckoutReady(config({ stripe: { enabled: true, saved: true } }, { VOZEB_PRO_STRIPE_SECRET_KEY: "sk_live_real_key" }), "stripe")).toBe(true);
    });

    it("keeps Alipay official checkout ready with the built-in default mode", () => {
        expect(isPaymentRuntimeProviderCheckoutReady(config({ alipay: { enabled: true, saved: true } }, alipayValues()), "alipay")).toBe(true);
    });

    it("accepts Alipay face-to-face mode as the same user-visible provider", () => {
        expect(isPaymentRuntimeProviderCheckoutReady(config({ alipay: { enabled: true, saved: true } }, alipayValues("face_to_face")), "alipay")).toBe(true);
    });

    it("rejects an unsupported Alipay mode", () => {
        expect(isPaymentRuntimeProviderCheckoutReady(config({ alipay: { enabled: true, saved: true } }, alipayValues("both")), "alipay")).toBe(false);
    });

    it("bootstraps a platform merchant account with a stable legacy idempotency key", async () => {
        const bootstrapLegacy = vi.fn().mockResolvedValue({ id: "merchant-stripe" });

        await bootstrapLegacyPaymentMerchantAccounts({
            runtimeConfig: {
                saved: {
                    providers: {
                        stripe: {
                            enabled: true,
                            values: { secretKey: "sk_live_real_key", webhookSecret: "whsec_real_key" },
                        },
                    },
                },
                providers: { stripe: { enabled: true, saved: true } },
                valuesByEnvName: {},
            },
            merchantAccountService: { bootstrapLegacy },
            environment: "production",
        });

        expect(bootstrapLegacy).toHaveBeenCalledWith(
            { ownerType: "platform", ownerId: "platform" },
            {
                provider: "stripe",
                environment: "production",
                credentials: { secretKey: "sk_live_real_key", webhookSecret: "whsec_real_key" },
                webhookIdentity: "legacy:platform:stripe:production",
            },
            "legacy-payment-config:platform:stripe:production",
            "enabled",
        );
    });
});

function config(providers: PaymentRuntimeConfig["providers"] = {}, valuesByEnvName: Record<string, string> = {}): PaymentRuntimeConfig {
    return { saved: { providers: {} }, providers, valuesByEnvName };
}

function alipayValues(mode?: string) {
    return {
        ...(mode ? { VOZEB_PRO_ALIPAY_MODE: mode } : {}),
        VOZEB_PRO_ALIPAY_APP_ID: "2026000000000000",
        VOZEB_PRO_ALIPAY_PRIVATE_KEY: "private-key-data",
    };
}
