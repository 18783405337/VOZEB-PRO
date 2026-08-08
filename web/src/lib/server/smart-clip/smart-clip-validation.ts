import { readJsonBodyResult } from "@/lib/auth/request";
import type { JsonValue } from "@/lib/server/database/repository-types";
import type { SmartClipType } from "@/lib/server/database/smart-clip-repository";

export type SmartClipTaskRequest = Readonly<{
    clipType: SmartClipType;
    styleId: string;
    title: string;
    videoUri: string;
    audioUri: string;
    language: string;
    materials: JsonValue;
    introduceCard: JsonValue;
    packRules: JsonValue;
    processRules: JsonValue;
    structLayers: JsonValue;
    subtitle: JsonValue;
    sourceApp: string;
    sourceResultId: string;
    quality: string;
    ratio: string;
    durationSeconds: number;
    quantity: number;
}>;

const SMART_CLIP_TYPES = new Set<SmartClipType>(["realman_broadcast", "broadcast_mixcut", "news_mixcut"]);
const SMART_CLIP_RATIOS = new Set(["duration", "16:9", "9:16", "1:1"]);

export function parseSmartClipTaskInput(value: unknown): SmartClipTaskRequest {
    const body = recordValue(value);
    const clipType = SMART_CLIP_TYPES.has(body.clipType as SmartClipType) ? (body.clipType as SmartClipType) : undefined;
    const title = requiredText(body.title, 120);
    const videoUri = boundedText(body.videoUri, 2_000);
    const audioUri = boundedText(body.audioUri, 2_000);
    const materials = jsonInput(body.materials, []);
    const durationSeconds = boundedInteger(body.durationSeconds, 0, 3_600);
    const quantity = boundedInteger(body.quantity, 1, 20) || 1;
    const ratio = boundedText(body.ratio, 32) || "duration";

    if (!clipType) throw new SmartClipInputError("Unsupported smart clip type");
    if (!title) throw new SmartClipInputError("A smart clip title is required");
    if (!videoUri && !audioUri && (!Array.isArray(materials) || materials.length === 0)) {
        throw new SmartClipInputError("Provide a source video, audio, or materials");
    }
    if (!SMART_CLIP_RATIOS.has(ratio)) throw new SmartClipInputError("Unsupported smart clip ratio");

    return {
        clipType,
        styleId: boundedText(body.styleId, 100),
        title,
        videoUri,
        audioUri,
        language: boundedText(body.language, 32),
        materials,
        introduceCard: jsonInput(body.introduceCard, {}),
        packRules: jsonInput(body.packRules, {}),
        processRules: jsonInput(body.processRules, {}),
        structLayers: jsonInput(body.structLayers, []),
        subtitle: jsonInput(body.subtitle, {}),
        sourceApp: boundedText(body.sourceApp, 100),
        sourceResultId: boundedText(body.sourceResultId, 160),
        quality: boundedText(body.quality, 32) || "1",
        ratio,
        durationSeconds,
        quantity,
    };
}

export async function readSmartClipBody(request: Request) {
    const parsed = await readJsonBodyResult<unknown>(request, 256 * 1024);
    if (!parsed.ok) throw new SmartClipInputError(parsed.message, parsed.status);
    return parsed.data;
}

export class SmartClipInputError extends Error {
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

function requiredText(value: unknown, maxLength: number) {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length > 0 && text.length <= maxLength ? text : "";
}

function boundedText(value: unknown, maxLength: number) {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length <= maxLength ? text : "";
}

function boundedInteger(value: unknown, min: number, max: number) {
    if (value === undefined || value === null || value === "") return 0;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? Math.floor(number) : 0;
}

function jsonInput(value: unknown, fallback: JsonValue): JsonValue {
    if (value === undefined || value === null) return fallback;
    return isJsonValue(value) ? value : fallback;
}

function isJsonValue(value: unknown): value is JsonValue {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(isJsonValue);
    if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isJsonValue);
    return false;
}
