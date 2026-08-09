import { requestSpecializedProvider } from "@/lib/server/specialized-provider/provider-http";
import { extractProviderError, extractProviderMediaUrls, normalizeProviderTaskState, requireProviderTaskId } from "@/lib/server/specialized-provider/provider-response";

export type SmartClipProviderContext = Readonly<{
    baseUrl: string;
    apiKey: string;
    timeoutMs: number;
    submitPath?: string;
    queryPath?: string;
}>;

export type SmartClipProviderRequest = Readonly<{
    clipType: "realman_broadcast" | "broadcast_mixcut" | "news_mixcut";
    styleId: string;
    title: string;
    videoUrl: string;
    audioUrl: string;
    language: string;
    materials: unknown;
    introduceCard: unknown;
    packRules: unknown;
    processRules: unknown;
    structLayers: unknown;
    subtitle: unknown;
    callbackUrl?: string;
    extraPayload?: Record<string, unknown>;
}>;

export type SmartClipProviderResult = Readonly<{
    taskId: string;
    state: "pending" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";
    mediaUrl: string;
    error: string;
    payload: Record<string, unknown>;
}>;

type ProviderFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_SUBMIT_PATHS: Record<SmartClipProviderRequest["clipType"], string> = {
    realman_broadcast: "/api/v1/apps/smart_clip/realman_broadcast",
    broadcast_mixcut: "/api/v1/apps/smart_clip/broadcast_mixcut",
    news_mixcut: "/api/v1/apps/smart_clip/news_mixcut",
};
const DEFAULT_QUERY_PATH = "/api/v1/tasks/{task_id}";

export class XhadminSmartClipProvider {
    constructor(private readonly fetcher?: ProviderFetcher) {}

    async submit(request: SmartClipProviderRequest, context: SmartClipProviderContext): Promise<SmartClipProviderResult> {
        const body = compact({
            styleId: request.styleId,
            videoUrl: request.videoUrl,
            audioUrl: request.audioUrl,
            title: request.title,
            language: request.language,
            materials: request.clipType === "realman_broadcast" ? undefined : request.materials,
            introduceCard: request.introduceCard,
            packRules: request.packRules,
            processRules: request.processRules,
            structLayers: request.structLayers,
            subtitle: request.subtitle,
            callbackUrl: request.callbackUrl,
            ...request.extraPayload,
        });
        const response = await requestSpecializedProvider({
            baseUrl: context.baseUrl,
            apiKey: context.apiKey,
            method: "POST",
            path: context.submitPath || DEFAULT_SUBMIT_PATHS[request.clipType],
            body,
            timeoutMs: context.timeoutMs,
        }, this.fetcher);
        return {
            taskId: requireProviderTaskId(response),
            state: normalizeProviderTaskState(response),
            mediaUrl: extractProviderMediaUrls(response, "video")[0] || "",
            error: extractProviderError(response),
            payload: response,
        };
    }

    async query(taskId: string, context: SmartClipProviderContext): Promise<SmartClipProviderResult> {
        const safeTaskId = taskId.trim();
        if (!safeTaskId) throw new Error("Provider task ID is required");
        const path = (context.queryPath || DEFAULT_QUERY_PATH).replace("{task_id}", encodeURIComponent(safeTaskId));
        const response = await requestSpecializedProvider({
            baseUrl: context.baseUrl,
            apiKey: context.apiKey,
            method: "GET",
            path,
            timeoutMs: context.timeoutMs,
            allowBusinessError: true,
        }, this.fetcher);
        return {
            taskId: safeTaskId,
            state: normalizeProviderTaskState(response),
            mediaUrl: extractProviderMediaUrls(response, "video")[0] || "",
            error: extractProviderError(response),
            payload: response,
        };
    }
}

function compact(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}
