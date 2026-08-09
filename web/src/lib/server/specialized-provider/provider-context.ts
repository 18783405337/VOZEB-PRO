import type { SpecializedProviderAppKey } from "@/lib/auth/store-types";

import {
    isSpecializedProviderProtocol,
    specializedProtocolSupportsApp,
    SpecializedProviderError,
    type SpecializedProviderContext,
    type SpecializedProviderTaskSnapshot,
} from "./provider-types";

type SpecializedProviderCandidate = {
    logicalModelId: string;
    upstreamModel: string;
    channelId: string;
    channel: {
        baseUrl: string;
        apiKey: string;
        advancedConfig?: unknown;
    };
};

export function resolveSpecializedProviderContext(candidate: SpecializedProviderCandidate, appKey: SpecializedProviderAppKey): SpecializedProviderContext {
    const config = asRecord(candidate.channel.advancedConfig);
    const protocol = config?.specializedProtocol;
    if (!isSpecializedProviderProtocol(protocol)) throw new SpecializedProviderError("Physical channel has no reviewed specialized protocol", "UNKNOWN_PROTOCOL");
    if (!specializedProtocolSupportsApp(protocol, appKey)) {
        throw new SpecializedProviderError("Physical channel protocol is not compatible with this application", "APP_PROTOCOL_MISMATCH");
    }

    const baseUrl = normalizeBaseUrl(candidate.channel.baseUrl);
    if (!baseUrl) throw new SpecializedProviderError("Physical channel Base URL is invalid", "INVALID_BASE_URL");
    const apiKey = candidate.channel.apiKey.trim();
    if (!apiKey) throw new SpecializedProviderError("Physical channel credentials are missing", "MISSING_CREDENTIALS");

    return {
        appKey,
        logicalModelKey: candidate.logicalModelId,
        upstreamModel: candidate.upstreamModel,
        channelId: candidate.channelId,
        baseUrl,
        apiKey,
        protocol,
        timeoutMs: normalizeTimeout(config?.specializedTimeoutMs ?? config?.timeoutMs ?? config?.timeout),
        specializedConfig: normalizeSpecializedConfig(config?.specializedConfig),
    };
}

export function specializedProviderTaskSnapshot(context: SpecializedProviderContext): SpecializedProviderTaskSnapshot {
    return {
        logicalModelKey: context.logicalModelKey,
        upstreamModel: context.upstreamModel,
        protocol: context.protocol,
    };
}

function normalizeBaseUrl(value: string) {
    try {
        const url = new URL(value.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") return "";
        if (url.username || url.password) return "";
        return url.toString().replace(/\/+$/, "");
    } catch {
        return "";
    }
}

function normalizeTimeout(value: unknown) {
    const timeout = Number(value);
    return Number.isFinite(timeout) ? Math.max(5_000, Math.min(300_000, Math.floor(timeout))) : 60_000;
}

function normalizeSpecializedConfig(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const input = value as Record<string, unknown>;
    return {
        klingMode: input.klingMode === "pro" ? "pro" as const : input.klingMode === "std" ? "std" as const : undefined,
        klingPrompt: typeof input.klingPrompt === "string" ? input.klingPrompt.trim().slice(0, 1000) : undefined,
        klingCallbackUrl: typeof input.klingCallbackUrl === "string" ? input.klingCallbackUrl.trim().slice(0, 2000) : undefined,
        klingWatermarkEnabled: typeof input.klingWatermarkEnabled === "boolean" ? input.klingWatermarkEnabled : undefined,
    };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
