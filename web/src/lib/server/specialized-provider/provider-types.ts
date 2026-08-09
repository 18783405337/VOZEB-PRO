import { SPECIALIZED_PROVIDER_PROTOCOLS, type SpecializedProviderAppKey, type SpecializedProviderProtocol } from "@/lib/auth/store-types";

export { SPECIALIZED_PROVIDER_PROTOCOLS };
export type { SpecializedProviderProtocol };
export type SpecializedProviderTaskState = "pending" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";
export type SpecializedProviderErrorCode =
    | "UNKNOWN_PROTOCOL"
    | "APP_PROTOCOL_MISMATCH"
    | "INVALID_BASE_URL"
    | "MISSING_CREDENTIALS"
    | "HTTP_ERROR"
    | "NETWORK_ERROR"
    | "TIMEOUT"
    | "MALFORMED_RESPONSE";

export type SpecializedProviderContext = Readonly<{
    appKey: SpecializedProviderAppKey;
    logicalModelKey: string;
    upstreamModel: string;
    channelId: string;
    baseUrl: string;
    apiKey: string;
    protocol: SpecializedProviderProtocol;
    timeoutMs: number;
    specializedConfig?: {
        klingMode?: "std" | "pro";
        klingPrompt?: string;
        klingCallbackUrl?: string;
        klingWatermarkEnabled?: boolean;
    };
}>;

export type SpecializedProviderTaskSnapshot = Readonly<{
    logicalModelKey: string;
    upstreamModel: string;
    protocol: SpecializedProviderProtocol;
}>;

export class SpecializedProviderError extends Error {
    constructor(
        message: string,
        readonly code: SpecializedProviderErrorCode,
        readonly options: {
            status?: number;
            retryable?: boolean;
        } = {},
    ) {
        super(message);
        this.name = "SpecializedProviderError";
    }

    get status() {
        return this.options.status;
    }

    get retryable() {
        return Boolean(this.options.retryable);
    }
}

export function isSpecializedProviderProtocol(value: unknown): value is SpecializedProviderProtocol {
    return typeof value === "string" && SPECIALIZED_PROVIDER_PROTOCOLS.includes(value as SpecializedProviderProtocol);
}

export function specializedProtocolSupportsApp(protocol: SpecializedProviderProtocol, appKey: SpecializedProviderAppKey) {
    if (appKey === "aigc-digital-human") return protocol === "xhadmin-digital-human-v1" || protocol === "kling-avatar-v1";
    if (appKey === "image-human") return protocol === "xhadmin-image-human-v1";
    return protocol === "xhadmin-action-transfer-v1";
}

export function sanitizeSpecializedProviderMessage(value: unknown, secrets: string[] = []) {
    let message = value instanceof Error ? value.message : typeof value === "string" ? value : "Provider request failed";
    message = message
        .replace(/authorization\s*:\s*[^\s,;]+(?:\s+[^\s,;]+)?/gi, "Authorization: [redacted]")
        .replace(/bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
    for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
        message = message.split(secret).join("[redacted]");
    }
    return message.trim().slice(0, 500) || "Provider request failed";
}
