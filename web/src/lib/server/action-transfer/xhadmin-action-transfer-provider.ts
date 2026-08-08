import { requestSpecializedProvider } from "@/lib/server/specialized-provider/provider-http";
import { extractProviderError, extractProviderMediaUrls, normalizeProviderTaskState, requireProviderTaskId } from "@/lib/server/specialized-provider/provider-response";
import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

export type ActionTransferProviderRequest = Readonly<{
    localTaskId: string;
    referenceImageUrls: string[];
    sourceVideoUrl: string;
    prompt: string;
    mode: string;
    faceCount: number;
    duration: number;
    providerParams?: Record<string, unknown>;
}>;

export type ActionTransferProviderResult = Readonly<{
    taskId: string;
    state: "pending" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";
    mediaUrl: string;
    error: string;
    payload: Record<string, unknown>;
}>;

type ProviderFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

const SUBMIT_PATH = "/api/v1/apps/action_transfer/submit";
const QUERY_PATH = "/api/v1/apps/action_transfer/query";

export class XhadminActionTransferProvider {
    readonly protocol = "xhadmin-action-transfer-v1" as const;

    constructor(private readonly fetcher?: ProviderFetcher) {}

    async submit(request: ActionTransferProviderRequest, context: SpecializedProviderContext): Promise<ActionTransferProviderResult> {
        const params = record(request.providerParams);
        const response = await requestSpecializedProvider(
            {
                baseUrl: context.baseUrl,
                apiKey: context.apiKey,
                method: "POST",
                path: text(params.submit_path) || SUBMIT_PATH,
                body: compact({
                    type: "action_transfer",
                    ...record(params.channel_extra_payload),
                    ...record(params.payload),
                    file_url: request.referenceImageUrls.slice(0, 3).map((url) => httpsFileUrl(url, "referenceImageUrls")),
                    video_url: httpsFileUrl(request.sourceVideoUrl, "sourceVideoUrl"),
                    prompt: request.prompt,
                    mode: request.mode,
                    face_count: request.faceCount > 0 ? Math.floor(request.faceCount) : undefined,
                    duration: request.duration > 0 ? request.duration : undefined,
                    client_task_id: text(params.client_task_id),
                    idempotency_key: text(params.idempotency_key),
                    local_task_id: text(params.local_task_id),
                    local_task_sn: text(params.local_task_sn),
                }),
                timeoutMs: context.timeoutMs,
            },
            this.fetcher,
        );
        return {
            taskId: requireProviderTaskId(response),
            state: normalizeProviderTaskState(response),
            mediaUrl: "",
            error: extractProviderError(response),
            payload: response,
        };
    }

    async query(taskId: string, context: SpecializedProviderContext): Promise<ActionTransferProviderResult> {
        const response = await requestSpecializedProvider(
            {
                baseUrl: context.baseUrl,
                apiKey: context.apiKey,
                method: "POST",
                path: QUERY_PATH,
                body: { task_id: taskId },
                timeoutMs: context.timeoutMs,
                allowBusinessError: true,
            },
            this.fetcher,
        );
        return {
            taskId,
            state: normalizeProviderTaskState(response),
            mediaUrl: extractProviderMediaUrls(response, "video")[0] || "",
            error: extractProviderError(response),
            payload: response,
        };
    }
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function httpsFileUrl(value: string, field: string) {
    const url = text(value);
    if (!/^https:\/\//i.test(url)) throw new Error(`${field} must be an HTTPS URL`);
    return url;
}

function compact(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "" && (!Array.isArray(item) || item.length > 0)));
}
