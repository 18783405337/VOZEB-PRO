import { requestSpecializedProvider } from "@/lib/server/specialized-provider/provider-http";
import { extractProviderError, extractProviderMediaUrls, normalizeProviderTaskState, requireProviderTaskId } from "@/lib/server/specialized-provider/provider-response";
import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

import type {
    DigitalHumanProvider,
    DigitalHumanProviderRequest,
    DigitalHumanProviderResult,
    DigitalHumanProviderSubmission,
} from "./digital-human-provider";

type ProviderFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

const TTS_PATH = "/api/v1/apps/voice_tts/tts_live";
const LIPSYNC_PATH = "/api/v1/apps/lipsync/submit";
const TASK_PATH = "/api/v1/tasks/{task_id}";

export class XhadminDigitalHumanProvider implements DigitalHumanProvider {
    readonly protocol = "xhadmin-digital-human-v1" as const;

    constructor(private readonly fetcher?: ProviderFetcher) {}

    async submitTts(request: DigitalHumanProviderRequest, context: SpecializedProviderContext): Promise<DigitalHumanProviderSubmission> {
        const params = record(request.providerParams);
        const payload = compact({
            text: request.scriptText,
            model: text(params.tts_model) || "s2-pro",
            format: text(params.tts_format) || "mp3",
            reference_id: request.voice.providerAssetId || "",
            normalize: true,
            client_task_id: text(params.client_task_id) || request.localTaskId,
            idempotency_key: text(params.idempotency_key) || `digital-human:${request.localTaskId}:tts`,
            local_task_id: text(params.local_task_id) || request.localTaskId,
            local_task_sn: text(params.local_task_sn) || request.localTaskId,
            ...record(params.tts_payload),
        });
        return this.submit(context, text(params.tts_path) || TTS_PATH, payload);
    }

    async queryTts(taskId: string, context: SpecializedProviderContext): Promise<DigitalHumanProviderResult> {
        return this.query(taskId, "audio", context);
    }

    async submitAvatar(request: DigitalHumanProviderRequest, audioUrl: string, context: SpecializedProviderContext): Promise<DigitalHumanProviderSubmission> {
        const params = record(request.providerParams);
        const payload = compact({
            mode: "async_query",
            model: text(params.lipsync_model) || context.upstreamModel || "xiaojiayu1.0",
            audio_url: audioUrl,
            video_url: request.avatar.mediaUrl,
            client_task_id: text(params.client_task_id) || request.localTaskId,
            idempotency_key: text(params.idempotency_key) || `digital-human:${request.localTaskId}:lipsync`,
            local_task_id: text(params.local_task_id) || request.localTaskId,
            local_task_sn: text(params.local_task_sn) || request.localTaskId,
            ...record(params.lipsync_payload),
        });
        return this.submit(context, text(params.lipsync_path) || LIPSYNC_PATH, payload);
    }

    async queryAvatar(taskId: string, context: SpecializedProviderContext): Promise<DigitalHumanProviderResult> {
        return this.query(taskId, "video", context);
    }

    private async submit(context: SpecializedProviderContext, path: string, body: Record<string, unknown>) {
        const payload = await requestSpecializedProvider(
            {
                baseUrl: context.baseUrl,
                apiKey: context.apiKey,
                method: "POST",
                path,
                body,
                timeoutMs: context.timeoutMs,
            },
            this.fetcher,
        );
        return { taskId: requireProviderTaskId(payload), payload };
    }

    private async query(taskId: string, kind: "audio" | "video", context: SpecializedProviderContext): Promise<DigitalHumanProviderResult> {
        const payload = await requestSpecializedProvider(
            {
                baseUrl: context.baseUrl,
                apiKey: context.apiKey,
                method: "GET",
                path: TASK_PATH.replace("{task_id}", encodeURIComponent(taskId)),
                timeoutMs: context.timeoutMs,
                allowBusinessError: true,
            },
            this.fetcher,
        );
        return {
            state: normalizeProviderTaskState(payload),
            mediaUrl: extractProviderMediaUrls(payload, kind)[0] || "",
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

function compact(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "" && (!Array.isArray(item) || item.length > 0)));
}
