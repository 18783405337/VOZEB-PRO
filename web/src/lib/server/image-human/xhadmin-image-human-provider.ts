import { requestSpecializedProvider } from "@/lib/server/specialized-provider/provider-http";
import { extractProviderError, extractProviderMediaUrls, normalizeProviderTaskState, requireProviderTaskId } from "@/lib/server/specialized-provider/provider-response";
import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

export type ImageHumanProviderRequest = Readonly<{
    localTaskId: string;
    imageUrl: string;
    audioUrl: string;
    scriptText: string;
    prompt: string;
    duration: number;
    mode: string;
    providerParams?: Record<string, unknown>;
}>;

export type ImageHumanProviderResult = Readonly<{
    taskId: string;
    state: "pending" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";
    mediaUrl: string;
    error: string;
    payload: Record<string, unknown>;
}>;

type ProviderFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

const SUBMIT_PATH = "/api/v1/apps/image_human/submit";
const QUERY_PATH = "/api/v1/apps/image_human/query";
const TASK_PATH = "/api/v1/tasks/{task_id}";

export class XhadminImageHumanProvider {
    readonly protocol = "xhadmin-image-human-v1" as const;

    constructor(private readonly fetcher?: ProviderFetcher) {}

    async submit(request: ImageHumanProviderRequest, context: SpecializedProviderContext): Promise<ImageHumanProviderResult> {
        const params = record(request.providerParams);
        const payload = compact({
            ...record(params.channel_extra_payload),
            ...record(params.payload),
            file_url: httpsFileUrl(request.imageUrl, "imageUrl"),
            ref_file_url: httpsFileUrl(request.audioUrl, "audioUrl"),
            script_text: request.scriptText,
            prompt: request.prompt,
            duration: request.duration > 0 ? request.duration : undefined,
            mode: request.mode,
            client_task_id: text(params.client_task_id),
            idempotency_key: text(params.idempotency_key),
            local_task_id: text(params.local_task_id),
            local_task_sn: text(params.local_task_sn),
        });
        const response = await this.request(context, text(params.submit_path) || SUBMIT_PATH, payload);
        return {
            taskId: requireProviderTaskId(response),
            state: normalizeProviderTaskState(response),
            mediaUrl: "",
            error: extractProviderError(response),
            payload: response,
        };
    }

    async query(taskId: string, context: SpecializedProviderContext): Promise<ImageHumanProviderResult> {
        const queryPayload = {
            task_id: numericOrText(taskId),
            elastic_task_id: numericOrText(taskId),
        };
        const response = await this.request(context, QUERY_PATH, queryPayload, true);
        const direct = this.result(taskId, response);
        if (direct.mediaUrl || direct.state === "pending" || direct.state === "running") return direct;
        if (taskId.startsWith("task_")) {
            const fallbackResponse = await this.request(context, TASK_PATH.replace("{task_id}", encodeURIComponent(taskId)), undefined, true, "GET");
            return this.result(taskId, fallbackResponse);
        }
        return direct;
    }

    private async request(context: SpecializedProviderContext, path: string, body?: Record<string, unknown>, allowBusinessError = false, method: "GET" | "POST" = "POST") {
        return requestSpecializedProvider(
            {
                baseUrl: context.baseUrl,
                apiKey: context.apiKey,
                method,
                path,
                body,
                timeoutMs: context.timeoutMs,
                allowBusinessError,
            },
            this.fetcher,
        );
    }

    private result(taskId: string, payload: Record<string, unknown>): ImageHumanProviderResult {
        return {
            taskId,
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

function numericOrText(value: string) {
    return /^\d+$/.test(value) ? Number(value) : value;
}

function httpsFileUrl(value: string, field: string) {
    const url = text(value);
    if (!/^https:\/\//i.test(url)) throw new Error(`${field} must be an HTTPS URL`);
    return url;
}

function compact(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "" && (!Array.isArray(item) || item.length > 0)));
}
