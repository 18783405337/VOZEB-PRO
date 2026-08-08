import type { PaymentForm } from "./payment-form";
import type { ResolvedMerchantAccount } from "./payment/merchant-account-service";

export type PaymentCheckoutKind = "manual" | "redirect" | "form" | "qr";

export type PaymentCheckoutResult = {
    provider: string;
    orderId: string;
    orderNo: string;
    kind: PaymentCheckoutKind;
    url?: string;
    form?: PaymentForm;
    qrContent?: string;
    providerOrderId?: string;
    providerPaymentId?: string;
    expiresAt?: string;
};

export type CreatePaymentCheckoutOptions = {
    origin?: string;
    provider?: unknown;
    userId?: string;
    tenantId?: string;
    merchantAccountId?: string;
    collectionMode?: "platform" | "tenant";
};

export type { ResolvedMerchantAccount };
