import { SpecializedProviderError, type SpecializedProviderTaskState } from "./provider-types";

const TASK_ID_PATHS = [
    "task_id",
    "id",
    "data.task_id",
    "data.id",
    "result.task_id",
    "result.id",
    "data.task.task_id",
    "data.task.id",
    "data.result.task_id",
    "data.result.id",
] as const;

const STATUS_PATHS = [
    "status",
    "state",
    "data.status",
    "data.state",
    "data.task_status",
    "result.status",
    "result.state",
    "data.task.status",
    "data.task.state",
    "data.result.status",
    "data.result.state",
] as const;

const ERROR_PATHS = ["message", "msg", "error", "error.message", "data.error", "data.message", "data.task_status_msg", "data.result.error", "data.result.message", "result.error", "result.message"] as const;

const MEDIA_PATHS = {
    audio: ["audio_url", "audio.url", "output.audio_url", "result.audio_url", "result.output.audio_url", "data.audio_url", "data.output.audio_url", "data.result.audio_url", "data.result.output.audio_url"],
    video: [
        "video_url",
        "output_url",
        "url",
        "output.video_url",
        "output.output_url",
        "result.video_url",
        "result.output_url",
        "result.url",
        "result.output.video_url",
        "data.video_url",
        "data.output_url",
        "data.url",
        "data.output.video_url",
        "data.output.output_url",
        "data.result.video_url",
        "data.result.output_url",
        "data.result.url",
        "data.result.output.video_url",
        "data.result.data.video_url",
        "data.result.data.output_url",
        "data.result.data.url",
    ],
} as const;

export function extractProviderTaskId(payload: unknown) {
    return firstScalar(payload, TASK_ID_PATHS);
}

export function requireProviderTaskId(payload: unknown) {
    const taskId = extractProviderTaskId(payload);
    if (!taskId) throw new SpecializedProviderError("Provider response did not include a task identifier", "MALFORMED_RESPONSE");
    return taskId;
}

export function normalizeProviderTaskState(payload: unknown): SpecializedProviderTaskState {
    const status = firstScalar(payload, STATUS_PATHS).toLowerCase();
    if (["pending", "queued", "created", "waiting", "submitted"].includes(status)) return "pending";
    if (["running", "processing", "in_progress", "generating"].includes(status)) return "running";
    if (["success", "succeed", "succeeded", "completed", "complete", "done", "finished"].includes(status)) return "succeeded";
    if (["failed", "fail", "error", "rejected"].includes(status)) return "failed";
    if (["cancelled", "canceled"].includes(status)) return "cancelled";
    return "unknown";
}

export function extractProviderMediaUrls(payload: unknown, kind: "audio" | "video") {
    const urls = MEDIA_PATHS[kind].flatMap((path) => mediaValues(readPath(payload, path), kind));
    for (const path of ["results", "data.results", "data.result.results", "data.result.data.results", "data.task_result.videos"]) {
        urls.push(...mediaValues(readPath(payload, path), kind));
    }
    return Array.from(new Set(urls.filter((url) => isSupportedMediaUrl(url) && isCompatibleMediaUrl(url, kind))));
}

export function extractProviderError(payload: unknown) {
    return firstScalar(payload, ERROR_PATHS);
}

export function providerResponseSucceeded(payload: unknown) {
    const record = asRecord(payload);
    if (!record) return false;
    if (record.success === true) return true;
    if (record.success === false || record.error) return false;
    if (!Object.prototype.hasOwnProperty.call(record, "code")) return true;
    const code = String(record.code).trim().toLowerCase();
    return ["0", "1", "200", "ok", "success", "succeeded"].includes(code);
}

function mediaValues(value: unknown, kind: "audio" | "video"): string[] {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap((item) => mediaValues(item, kind));
    const record = asRecord(value);
    if (!record) return [];
    const keys = kind === "audio" ? ["audio_url", "audioUrl", "url"] : ["video_url", "videoUrl", "output_url", "outputUrl", "url"];
    return keys.flatMap((key) => mediaValues(record[key], kind));
}

function isSupportedMediaUrl(value: string) {
    return /^https?:\/\//i.test(value) || /^(?:data|blob):(audio|video)\//i.test(value);
}

function isCompatibleMediaUrl(value: string, kind: "audio" | "video") {
    const pathname = value.split(/[?#]/, 1)[0].toLowerCase();
    if (kind === "audio") return !/\.(?:mp4|mov|mkv|webm|avi|m4v)$/.test(pathname) && !/^data:video\//i.test(value);
    return !/\.(?:mp3|wav|aac|m4a|flac|ogg|opus)$/.test(pathname) && !/^data:audio\//i.test(value);
}

function firstScalar(payload: unknown, paths: readonly string[]) {
    for (const path of paths) {
        const value = readPath(payload, path);
        if ((typeof value === "string" || typeof value === "number") && String(value).trim()) return String(value).trim();
    }
    return "";
}

function readPath(payload: unknown, path: string): unknown {
    let current: unknown = payload;
    for (const part of path.split(".")) {
        const record = asRecord(current);
        if (!record || !(part in record)) return undefined;
        current = record[part];
    }
    return current;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
