import { fetchSafeOutbound } from "@/lib/server/safe-outbound-fetch";

import { extractProviderError, providerResponseSucceeded } from "./provider-response";
import { sanitizeSpecializedProviderMessage, SpecializedProviderError } from "./provider-types";

type ProviderFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type SpecializedProviderRequest = {
    baseUrl: string;
    apiKey: string;
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: Record<string, unknown>;
    timeoutMs?: number;
    allowBusinessError?: boolean;
};

export function joinSpecializedProviderUrl(baseUrl: string, path: string) {
    const base = new URL(baseUrl);
    if (path.startsWith("/")) return new URL(path, base.origin).toString();
    const normalizedBase = base.toString().endsWith("/") ? base : new URL(`${base.pathname.replace(/\/+$/, "")}/`, base.origin);
    return new URL(path, normalizedBase).toString();
}

export async function requestSpecializedProvider(input: SpecializedProviderRequest, fetcher: ProviderFetcher = fetchSafeOutbound): Promise<Record<string, unknown>> {
    const url = new URL(joinSpecializedProviderUrl(input.baseUrl, input.path));
    for (const [key, value] of Object.entries(input.query || {})) {
        if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    const headers = new Headers({
        accept: "application/json",
        authorization: `Bearer ${input.apiKey}`,
    });
    const init: RequestInit = {
        method: input.method,
        headers,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(normalizeTimeout(input.timeoutMs)),
    };
    if (input.method === "POST") {
        headers.set("content-type", "application/json");
        init.body = JSON.stringify(input.body || {});
    }

    try {
        const response = await fetcher(url.toString(), init);
        const payload = await readJsonResponse(response);
        if (!response.ok) {
            throw new SpecializedProviderError(sanitizedResponseError(payload, response.status, input.apiKey), "HTTP_ERROR", {
                status: response.status,
                retryable: response.status === 408 || response.status === 429 || response.status >= 500,
            });
        }
        if (!input.allowBusinessError && !providerResponseSucceeded(payload)) {
            throw new SpecializedProviderError(sanitizedResponseError(payload, response.status, input.apiKey), "HTTP_ERROR", {
                status: response.status,
                retryable: false,
            });
        }
        return payload;
    } catch (error) {
        if (error instanceof SpecializedProviderError) throw error;
        if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
            throw new SpecializedProviderError("Provider request timed out", "TIMEOUT", { retryable: true });
        }
        throw new SpecializedProviderError(sanitizeSpecializedProviderMessage(error, [input.apiKey]), "NETWORK_ERROR", { retryable: true });
    }
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text();
    if (!text.trim()) return {};
    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
        // Handled below as a typed malformed provider response.
    }
    throw new SpecializedProviderError("Provider response was not valid JSON", "MALFORMED_RESPONSE", { status: response.status, retryable: response.status >= 500 });
}

function sanitizedResponseError(payload: unknown, status: number, apiKey: string) {
    return sanitizeSpecializedProviderMessage(extractProviderError(payload) || `Provider request failed with HTTP ${status}`, [apiKey]);
}

function normalizeTimeout(value: unknown) {
    const timeout = Number(value);
    return Number.isFinite(timeout) ? Math.max(1_000, Math.min(300_000, Math.floor(timeout))) : 60_000;
}
