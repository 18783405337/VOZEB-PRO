import { describe, expect, it } from "vitest";

import { assertCheckoutMerchantRequest, resolveCheckoutProvider } from "./payment-checkout-service";

describe("payment checkout provider snapshot", () => {
    it("keeps the provider selected when the order was created", () => {
        expect(resolveCheckoutProvider("alipay", undefined)).toBe("alipay");
        expect(resolveCheckoutProvider("alipay", "ali")).toBe("alipay");
    });

    it("requires a new order before switching payment providers", () => {
        expect(() => resolveCheckoutProvider("alipay", "wechat")).toThrow("订单支付渠道已锁定，请重新创建订单后更换渠道");
    });
    it("rejects checkout attempts that override the persisted merchant lineage", () => {
        expect(() =>
            assertCheckoutMerchantRequest(
                { merchantAccountId: "merchant-platform", collectionMode: "platform" },
                { merchantAccountId: "merchant-tenant", collectionMode: "tenant" },
            ),
        ).toThrow("Merchant account is locked to the order");
    });
});
