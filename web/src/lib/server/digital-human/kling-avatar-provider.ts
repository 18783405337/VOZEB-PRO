import { requestSpecializedProvider } from "@/lib/server/specialized-provider/provider-http";
import { extractProviderError, extractProviderMediaUrls, normalizeProviderTaskState, requireProviderTaskId } from "@/lib/server/specialized-provider/provider-response";
import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

import {
    UnsupportedDigitalHumanProviderOperation,
    type DigitalHumanProvider,
    type DigitalHumanProviderRequest,
    type DigitalHumanProviderResult,
    type DigitalHumanProviderSubmission,
} from "./digital-human-provider";

type ProviderFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

const CREATE_PATH = "/v1/videos/avatar/image2video";

export class KlingAvatarProvider implements DigitalHumanProvider {
    readonly protocol = "kling-avatar-v1" as const;

    constructor(private readonly fetcher?: ProviderFetcher) {}

    async submitTts(_request: DigitalHumanProviderRequest, _context: SpecializedProviderContext): Promise<DigitalHumanProviderSubmission> {
        throw new UnsupportedDigitalHumanProviderOperation(this.protocol, "tts");
    }

    async queryTts(_taskId: string, _context: SpecializedProviderContext): Promise<DigitalHumanProviderResult> {
        throw new UnsupportedDigitalHumanProviderOperation(this.protocol, "tts");
    }

    async submitAvatar(request: DigitalHumanProviderRequest, audioUrl: string, context: SpecializedProviderContext): Promise<DigitalHumanProviderSubmission> {
        const params = record(request.providerParams);
        const payload = await requestSpecializedProvider(
            {
                baseUrl: context.baseUrl,
                apiKey: context.apiKey,
                method: "POST",
                path: CREATE_PATH,
                body: compact({
                    image: request.avatar.mediaUrl,
                    sound_file: audioUrl || request.voice.mediaUrl,
                    prompt: text(params.prompt),
                    mode: params.mode === "pro" ? "pro" : "std",
                    external_task_id: request.localTaskId,
                    callback_url: text(params.callback_url),
                    watermark_info: booleanRecord(params.watermark_info),
                }),
                timeoutMs: context.timeoutMs,
            },
            this.fetcher,
        );
        return { taskId: requireProviderTaskId(payload), payload };
    }

    async queryAvatar(taskId: string, context: SpecializedProviderContext): Promise<DigitalHumanProviderResult> {
        const payload = await requestSpecializedProvider(
            {
                baseUrl: context.baseUrl,
                apiKey: context.apiKey,
                method: "GET",
                path: `${CREATE_PATH}/${encodeURIComponent(taskId)}`,
                timeoutMs: context.timeoutMs,
                allowBusinessError: true,
            },
            this.fetcher,
        );
        return {
            state: normalizeProviderTaskState(payload),
            mediaUrl: extractProviderMediaUrls(payload, "video")[0] || "",
            error: extractProviderError(payload),
            payload,
        };
    }
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function booleanRecord(value: unknown) {
    const input = record(value);
    return typeof input.enabled === "boolean" ? { enabled: input.enabled } : undefined;
}

function compact(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ""));
}
