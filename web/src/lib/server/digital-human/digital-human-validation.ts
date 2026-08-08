export type DigitalHumanAvatarRequest = Readonly<{
    id?: string;
    name: string;
    gender: string;
    scene: string;
    coverUri: string;
    mediaUri: string;
    mediaType: string;
}>;

export type DigitalHumanVoiceRequest = Readonly<{
    id?: string;
    name: string;
    gender: string;
    ageGroup: string;
    coverUri: string;
    audioUri: string;
    previewAudioUri: string;
    durationSeconds: number;
}>;

export type DigitalHumanTaskRequest = Readonly<{
    avatarId: string;
    voiceId: string;
    title: string;
    scriptText: string;
    prompt: string;
    mode: "fast" | "standard";
    ratio: "16:9" | "9:16" | "1:1";
}>;

export function parseDigitalHumanAvatarInput(value: unknown): DigitalHumanAvatarRequest {
    const body = recordValue(value);
    const name = requiredText(body.name, 80);
    const mediaUri = requiredText(body.mediaUri, 2_000);
    if (!name || !mediaUri) throw new DigitalHumanInputError("数字人形象名称和素材地址不能为空");
    return {
        id: optionalText(body.id, 100),
        name,
        gender: boundedText(body.gender, 32),
        scene: boundedText(body.scene, 64),
        coverUri: boundedText(body.coverUri, 2_000),
        mediaUri,
        mediaType: boundedText(body.mediaType, 32) || "image",
    };
}

export function parseDigitalHumanVoiceInput(value: unknown): DigitalHumanVoiceRequest {
    const body = recordValue(value);
    const name = requiredText(body.name, 80);
    const audioUri = requiredText(body.audioUri, 2_000);
    if (!name || !audioUri) throw new DigitalHumanInputError("数字人音色名称和音频地址不能为空");
    return {
        id: optionalText(body.id, 100),
        name,
        gender: boundedText(body.gender, 32),
        ageGroup: boundedText(body.ageGroup, 32),
        coverUri: boundedText(body.coverUri, 2_000),
        audioUri,
        previewAudioUri: boundedText(body.previewAudioUri, 2_000),
        durationSeconds: boundedDuration(body.durationSeconds),
    };
}

export function parseDigitalHumanTaskInput(value: unknown): DigitalHumanTaskRequest {
    const body = recordValue(value);
    const avatarId = requiredText(body.avatarId, 100);
    const voiceId = requiredText(body.voiceId, 100);
    const title = requiredText(body.title, 120);
    const scriptText = requiredText(body.scriptText, 10_000);
    if (!avatarId || !voiceId) throw new DigitalHumanInputError("数字人形象和音色不能为空");
    if (!title || !scriptText) throw new DigitalHumanInputError("数字人任务标题和文案不能为空");

    const mode = body.mode === "fast" ? "fast" : body.mode === "standard" || body.mode === undefined ? "standard" : "";
    const ratio = body.ratio === "9:16" || body.ratio === "1:1" ? body.ratio : body.ratio === "16:9" || body.ratio === undefined ? "16:9" : "";
    if (!mode || !ratio) throw new DigitalHumanInputError("数字人任务模式或画幅比例不合法");

    return {
        avatarId,
        voiceId,
        title,
        scriptText,
        prompt: boundedText(body.prompt, 4_000),
        mode,
        ratio,
    };
}

export class DigitalHumanInputError extends Error {
    constructor(
        message: string,
        readonly status = 400,
    ) {
        super(message);
    }
}

export async function readDigitalHumanBody(request: Request) {
    const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
    if (!parsed.ok) throw new DigitalHumanInputError(parsed.message, parsed.status);
    return parsed.data;
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function requiredText(value: unknown, maxLength: number) {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length > 0 && text.length <= maxLength ? text : "";
}

function optionalText(value: unknown, maxLength: number) {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length > 0 && text.length <= maxLength ? text : undefined;
}

function boundedText(value: unknown, maxLength: number) {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length <= maxLength ? text : "";
}

function boundedDuration(value: unknown) {
    if (value === undefined || value === null || value === "") return 0;
    const duration = Number(value);
    return Number.isFinite(duration) && duration >= 0 && duration <= 3_600 ? Math.floor(duration) : 0;
}
import { readJsonBodyResult } from "@/lib/auth/request";
