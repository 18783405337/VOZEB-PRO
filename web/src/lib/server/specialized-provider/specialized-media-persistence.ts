import { copyFile, mkdir, mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { recordGenerationLog } from "@/lib/server/generation-log-store";
import { createDatedMediaPath, GENERATION_MEDIA_ROOT } from "@/lib/server/local-media-storage";
import { listLocalMediaRegistrationsForUser, registerLocalMediaAsset } from "@/lib/server/local-media-registry";
import { downloadMediaToFile } from "@/lib/server/media-download";
import { persistExternalMediaIfEnabled } from "@/lib/server/object-storage-service";

const MAX_SPECIALIZED_VIDEO_BYTES = 300 * 1024 * 1024;

export type SpecializedTaskType = "digital-human" | "image-human" | "action-transfer";

export type SpecializedMediaPersistenceInput = {
    tenantId: string;
    userId: string;
    taskId: string;
    taskType: SpecializedTaskType;
    sourceUrl: string;
    origin: string;
    cookie?: string;
    internalHeaders?: HeadersInit;
    title?: string;
    model?: string;
    provider?: string;
};

export type SpecializedPersistedVideo = {
    url: string;
    storageKey: string;
    mimeType: string;
    bytes: number;
};

type SpecializedMediaPersistenceDependencies = {
    findExisting(input: SpecializedMediaPersistenceInput): Promise<SpecializedPersistedVideo | null>;
    store(input: SpecializedMediaPersistenceInput): Promise<SpecializedPersistedVideo>;
    record(input: SpecializedMediaPersistenceInput, asset: SpecializedPersistedVideo, logId: string): Promise<void>;
};

export function specializedMediaSource(taskType: SpecializedTaskType) {
    return `specialized-${taskType}`;
}

export function specializedMediaLogId(taskType: SpecializedTaskType, taskId: string) {
    return `specialized:${taskType}:${taskId}`.slice(0, 120);
}

export async function persistSpecializedVideoResult(input: SpecializedMediaPersistenceInput) {
    return persistSpecializedVideoResultWithDependencies(input, createDefaultDependencies());
}

export async function persistSpecializedVideoResultWithDependencies(
    input: SpecializedMediaPersistenceInput,
    dependencies: SpecializedMediaPersistenceDependencies,
) {
    const existing = await dependencies.findExisting(input);
    const asset = existing || (await dependencies.store(input));
    await dependencies.record(input, asset, specializedMediaLogId(input.taskType, input.taskId));
    return asset;
}

function createDefaultDependencies(): SpecializedMediaPersistenceDependencies {
    return {
        async findExisting(input) {
            const source = tenantMediaSource(input);
            const registrations = await listLocalMediaRegistrationsForUser(input.userId);
            const registration = registrations.find(
                (item) =>
                    item.scope === "generation" &&
                    item.storageClass === "permanent" &&
                    item.type === "video" &&
                    item.taskId === input.taskId &&
                    item.source === source,
            );
            return registration
                ? {
                      url: generationAssetUrl(registration.storageKey),
                      storageKey: registration.storageKey,
                      mimeType: registration.mimeType,
                      bytes: registration.bytes,
                  }
                : null;
        },
        async store(input) {
            const workdir = await mkdtemp(join(tmpdir(), "vozeb-specialized-video-"));
            const sourcePath = join(workdir, "provider-result");
            try {
                const downloaded = await downloadMediaToFile(input.sourceUrl, sourcePath, {
                    origin: input.origin,
                    cookie: input.cookie,
                    internalHeaders: input.internalHeaders,
                    maxBytes: MAX_SPECIALIZED_VIDEO_BYTES,
                    expectedType: "video",
                });
                const storageKey = createDatedMediaPath("permanent", "video", downloaded.extension);
                const registration = {
                    storageKey,
                    scope: "generation" as const,
                    storageClass: "permanent" as const,
                    type: "video" as const,
                    ownerUserId: input.userId,
                    originalName: `${input.taskType}-${input.taskId}.${downloaded.extension}`,
                    source: tenantMediaSource(input),
                    taskId: input.taskId,
                    mimeType: downloaded.mimeType,
                    bytes: downloaded.bytes,
                };
                const external = await persistExternalMediaIfEnabled({ registration, filePath: sourcePath });
                if (!external) {
                    const destination = resolve(GENERATION_MEDIA_ROOT, storageKey);
                    await mkdir(dirname(destination), { recursive: true });
                    await copyFile(sourcePath, destination);
                    try {
                        await registerLocalMediaAsset(registration);
                    } catch (error) {
                        await unlink(destination).catch(() => undefined);
                        throw error;
                    }
                }
                return {
                    url: generationAssetUrl(storageKey),
                    storageKey,
                    mimeType: downloaded.mimeType,
                    bytes: downloaded.bytes,
                };
            } finally {
                await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
            }
        },
        async record(input, asset, logId) {
            await recordGenerationLog({
                id: logId,
                taskId: input.taskId,
                tenantId: input.tenantId,
                userId: input.userId,
                username: "",
                displayName: "",
                kind: "video",
                source: "video-workbench",
                status: "success",
                title: input.title || specializedMediaTitle(input.taskType),
                prompt: "",
                model: input.model || input.provider || specializedMediaSource(input.taskType),
                summary: "Specialized provider video completed",
                count: 1,
                successCount: 1,
                failCount: 0,
                assets: [
                    {
                        type: "video",
                        url: asset.url,
                        serverUrl: asset.url,
                        mimeType: asset.mimeType,
                        bytes: asset.bytes,
                    },
                ],
            });
        },
    };
}

function tenantMediaSource(input: SpecializedMediaPersistenceInput) {
    return `${specializedMediaSource(input.taskType)}:${input.tenantId}`.slice(0, 160);
}

function generationAssetUrl(storageKey: string) {
    return `/api/generation-log-assets/${storageKey.split("/").map(encodeURIComponent).join("/")}`;
}

function specializedMediaTitle(taskType: SpecializedTaskType) {
    if (taskType === "digital-human") return "Digital human";
    if (taskType === "image-human") return "Image human";
    return "Action transfer";
}
