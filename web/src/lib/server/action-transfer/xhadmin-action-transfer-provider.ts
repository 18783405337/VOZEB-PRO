import { requestSpecializedProvider } from "@/lib/server/specialized-provider/provider-http";
import { extractProviderError, extractProviderMediaUrls, normalizeProviderTaskState, requireProviderTaskId } from "@/lib/server/specialized-provider/provider-response";
import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

export type ActionTransferProviderRequest = Readonly<{
    localTaskId: string;
    payload: Record<string, unknown>;
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
        const params = record(request.payload);
        const providerPayload = record(params.provider_payload);
        const bodyParams = { ...params };
        delete bodyParams.provider_payload;
        delete bodyParams.submit_path;
        const response = await requestSpecializedProvider(
            {
                baseUrl: context.baseUrl,
                apiKey: context.apiKey,
                method: "POST",
                path: SUBMIT_PATH,
                body: compact({
                    type: "action_transfer",
                    ...providerPayload,
                    ...bodyParams,
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

function compact(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "" && (!Array.isArray(item) || item.length > 0)));
}
