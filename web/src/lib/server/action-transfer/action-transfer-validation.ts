import { readJsonBodyResult } from "@/lib/auth/request";

export type ActionTransferTaskRequest = Readonly<{
    title: string;
    referenceImages: string[];
    sourceVideo: string;
    prompt: string;
    mode: "fast" | "standard" | "max";
    faceCount: number;
    duration: number;
}>;

export function parseActionTransferTaskInput(value: unknown): ActionTransferTaskRequest {
    const body = recordValue(value);
    const referenceImages = stringArray(body.referenceImages);
    if (referenceImages.length < 1 || referenceImages.length > 3) {
        throw new ActionTransferInputError("参考人物图片需要上传 1 到 3 张");
    }
    if (!referenceImages.every(isHttpsUrl)) {
        throw new ActionTransferInputError("参考人物图片必须使用 HTTPS 地址");
    }

    const sourceVideo = boundedText(body.sourceVideo, 2_000);
    if (!isHttpsUrl(sourceVideo)) {
        throw new ActionTransferInputError("动作源视频必须使用 HTTPS 地址");
    }

    const duration = Number(body.duration);
    if (!Number.isFinite(duration) || duration < 1 || duration > 300) {
        throw new ActionTransferInputError("视频时长必须在 1 到 300 秒之间");
    }

    const mode = body.mode === undefined || body.mode === "standard" ? "standard" : body.mode === "fast" ? "fast" : body.mode === "max" ? "max" : "";
    if (!mode) throw new ActionTransferInputError("生成模式不受支持");

    const faceCount = body.faceCount === undefined ? 1 : Number(body.faceCount);
    if (!Number.isInteger(faceCount) || faceCount < 1 || faceCount > 7) {
        throw new ActionTransferInputError("人物数量必须在 1 到 7 之间");
    }

    return {
        title: boundedText(body.title, 120) || "动作迁移",
        referenceImages,
        sourceVideo,
        prompt: boundedText(body.prompt, 2_000),
        mode,
        faceCount,
        duration: Math.floor(duration),
    };
}

export async function readActionTransferBody(request: Request) {
    const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
    if (!parsed.ok) throw new ActionTransferInputError(parsed.message, parsed.status);
    return parsed.data;
}

export class ActionTransferInputError extends Error {
    constructor(
        message: string,
        readonly status = 400,
    ) {
        super(message);
    }
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function boundedText(value: unknown, maxLength: number) {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length <= maxLength ? text : "";
}

function stringArray(value: unknown) {
    return Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
        : [];
}

function isHttpsUrl(value: string) {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}
