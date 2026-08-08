import { readJsonBodyResult } from "@/lib/auth/request";

export type ImageHumanTaskRequest = Readonly<{
    title: string;
    imageUrl: string;
    audioUrl: string;
    scriptText: string;
    prompt: string;
    duration: number;
    mode: "standard" | "pro";
}>;

export function parseImageHumanTaskInput(value: unknown): ImageHumanTaskRequest {
    const body = recordValue(value);
    const imageUrl = boundedText(body.imageUrl, 2_000);
    const audioUrl = boundedText(body.audioUrl, 2_000);
    if (!isHttpsUrl(imageUrl) || !isHttpsUrl(audioUrl)) {
        throw new ImageHumanInputError("人物图片和驱动音频必须使用 HTTPS 地址");
    }

    const duration = Number(body.duration);
    if (!Number.isFinite(duration) || duration < 1 || duration > 300) {
        throw new ImageHumanInputError("预计时长必须在 1 到 300 秒之间");
    }

    const mode = body.mode === undefined || body.mode === "standard" ? "standard" : body.mode === "pro" ? "pro" : "";
    if (!mode) throw new ImageHumanInputError("生成模式不受支持");

    return {
        title: boundedText(body.title, 120) || "图片数字人",
        imageUrl,
        audioUrl,
        scriptText: boundedText(body.scriptText, 10_000),
        prompt: boundedText(body.prompt, 4_000),
        duration: Math.floor(duration),
        mode,
    };
}

export async function readImageHumanBody(request: Request) {
    const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
    if (!parsed.ok) throw new ImageHumanInputError(parsed.message, parsed.status);
    return parsed.data;
}

export class ImageHumanInputError extends Error {
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

function isHttpsUrl(value: string) {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}
