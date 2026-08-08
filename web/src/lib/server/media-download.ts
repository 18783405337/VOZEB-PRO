import { open, unlink } from "node:fs/promises";

import { fetchInternalApi } from "@/lib/server/internal-origin";
import { inspectSafeMediaBody, UnsupportedMediaContentError } from "@/lib/server/media-content-validation";
import { fetchSafeOutbound } from "@/lib/server/safe-outbound-fetch";

type MediaDownloadInput = {
    origin: string;
    cookie?: string;
    internalHeaders?: HeadersInit;
    maxBytes: number;
    timeoutMs?: number;
    expectedType?: "image" | "video" | "audio";
};

export async function downloadMediaToFile(url: string, path: string, input: MediaDownloadInput) {
    const source = url.trim();
    if (!source) throw new Error("Media URL is empty");
    const internal = source.startsWith("/") && !source.startsWith("//");
    const target = internal ? `${input.origin.replace(/\/+$/, "")}${source}` : source;
    const internalHeaders = new Headers(input.internalHeaders);
    if (input.cookie) internalHeaders.set("cookie", input.cookie);
    const response = internal
        ? await fetchInternalApi(target, { headers: internalHeaders, signal: AbortSignal.timeout(input.timeoutMs || 3 * 60_000) })
        : await fetchExternalMedia(target, input.timeoutMs || 3 * 60_000);
    if (!response.ok) throw new Error(`Media download failed (${response.status})`);
    if (!response.body) throw new Error("Media file is empty");
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > input.maxBytes) throw new Error("Media file exceeds the size limit");

    const inspected = await inspectSafeMediaBody(response.body);
    if (input.expectedType && inspected.type !== input.expectedType) {
        await inspected.body.cancel("Unexpected media type").catch(() => undefined);
        throw new UnsupportedMediaContentError();
    }

    const file = await open(path, "w");
    let bytes = 0;
    try {
        const reader = inspected.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > input.maxBytes) {
                await reader.cancel();
                throw new Error("Media file exceeds the size limit");
            }
            await file.write(value);
        }
    } catch (error) {
        await file.close().catch(() => undefined);
        await unlink(path).catch(() => undefined);
        throw error;
    } finally {
        await file.close().catch(() => undefined);
    }
    if (!bytes) {
        await unlink(path).catch(() => undefined);
        throw new Error("Media file is empty");
    }
    return { bytes, extension: inspected.extension, mimeType: inspected.mimeType, type: inspected.type };
}

async function fetchExternalMedia(initialUrl: string, timeoutMs: number) {
    let target = initialUrl;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
        const response = await fetchSafeOutbound(target, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers.get("location");
        if (!location) throw new Error("Media redirect location is invalid");
        target = new URL(location, target).toString();
    }
    throw new Error("Media redirect limit exceeded");
}
