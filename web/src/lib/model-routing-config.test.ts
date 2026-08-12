import { describe, expect, it } from "vitest";

import type { LogicalModel, SystemModelChannel } from "@/lib/auth/store";
import { emptyAdvancedConfig } from "@/lib/channel-protocol-registry";
import {
    channelDetectedCapabilities,
    channelModelCapability,
    deriveLogicalModelsConfig,
    isLogicalModelResolvable,
    mergeChannelModelsIntoLogicalModels,
    modelRoutingValidationErrors,
    normalizeDefaultModelsConfig,
    normalizeLogicalModelsConfig,
    resolveLogicalModelConfig,
    synchronizeLogicalModelsWithChannels,
} from "./model-routing-config";

const channel = (id: string, models: string[], enabled = true): SystemModelChannel => ({ id, name: id, baseUrl: `https://${id}.example.com/v1`, apiKey: "test-secret", apiFormat: "openai", models, enabled });

describe("model routing config", () => {
    it("maps a channel specialized protocol to the corresponding application model", () => {
        const models = synchronizeLogicalModelsWithChannels([], [{ id: "digital-channel", name: "数字人渠道", baseUrl: "https://provider.example", apiKey: "", apiFormat: "openai", models: ["avatar-v1"], enabled: true, advancedConfig: { ...emptyAdvancedConfig(), specializedProtocol: "xhadmin-digital-human-v1" } }]);
        expect(models).toEqual([expect.objectContaining({ id: "avatar-v1", appKeys: ["aigc-digital-human"] })]);
    });
    it("removes missing, unsupported, and duplicate bindings", () => {
        const channels = [channel("one", ["models/GPT-TEST"]), channel("two", ["gpt-test-2"], false)];
        const models: LogicalModel[] = [
            {
                id: "writer",
                name: "Writer",
                capability: "text",
                enabled: true,
                bindings: [
                    { id: "one", channelId: "one", upstreamModel: "gpt-test", enabled: true, priority: 2 },
                    { id: "duplicate", channelId: "one", upstreamModel: "models/GPT-TEST", enabled: true, priority: 1 },
                    { id: "missing", channelId: "missing", upstreamModel: "gpt-test", enabled: true, priority: 3 },
                    { id: "unsupported", channelId: "two", upstreamModel: "other", enabled: true, priority: 4 },
                ],
            },
        ];
        expect(normalizeLogicalModelsConfig(models, channels)[0].bindings).toEqual([{ id: "one", channelId: "one", upstreamModel: "models/GPT-TEST", enabled: true, priority: 2 }]);
    });

    it("normalizes reviewed specialized application scopes and preserves them during channel synchronization", () => {
        const channels = [channel("one", ["digital-human-v1"])];
        const models: LogicalModel[] = [
            {
                id: "digital-human",
                name: "Digital Human",
                capability: "video",
                enabled: true,
                appKeys: [" aigc-digital-human", "aigc-digital-human", "image-human", "unknown-app", ""] as never,
                bindings: [{ id: "one", channelId: "one", upstreamModel: "digital-human-v1", enabled: true, priority: 1 }],
            },
        ];

        expect(normalizeLogicalModelsConfig(models, channels)[0]?.appKeys).toEqual(["aigc-digital-human", "image-human"]);
    });

    it("requires an enabled binding for specialized application scopes", () => {
        const channels = [channel("one", ["digital-human-v1"])];
        const models: LogicalModel[] = [
            {
                id: "digital-human",
                name: "Digital Human",
                capability: "video",
                enabled: true,
                appKeys: ["aigc-digital-human"],
                bindings: [{ id: "one", channelId: "one", upstreamModel: "digital-human-v1", enabled: false, priority: 1 }],
            },
        ];

        expect(modelRoutingValidationErrors(models, channels, { textModel: "", imageModel: "", videoModel: "", audioModel: "" })).toContain("专项逻辑模型 digital-human 至少需要一个启用的渠道绑定");
    });

    it("hides channel models disabled by model-level configuration", () => {
        const source = channel("one", ["video-a", "video-b"]);
        source.advancedConfig = {
            protocol: "tianyue-video",
            modelConfigs: {
                "video-a": { capability: "video", protocol: "tianyue-video", enabled: false },
                "video-b": { capability: "video", protocol: "tianyue-video", enabled: true },
            },
        } as never;

        const models = synchronizeLogicalModelsWithChannels([], [source]);

        expect(models.map((model) => model.id)).toEqual(["video-b"]);
        expect(isLogicalModelResolvable(models, [source], "video", "video-a")).toBe(false);
        expect(isLogicalModelResolvable(models, [source], "video", "video-b")).toBe(true);
    });

    it("rebuilds an explicitly empty logical model catalog from channel models", () => {
        const channels = [channel("one", ["writer"])];

        expect(normalizeLogicalModelsConfig([], channels)).toHaveLength(1);
        expect(normalizeLogicalModelsConfig(undefined, channels)).toHaveLength(1);
    });

    it("distinguishes SD2.0 video aliases from full Stable Diffusion image names", () => {
        const models = normalizeLogicalModelsConfig(undefined, [channel("one", ["sd2.0", "sd_2.0_fast_discount_720p", "seedance-2.0", "stable-diffusion-2.0", "sdxl"])]);

        expect(models.find((model) => model.id === "sd2.0")?.capability).toBe("video");
        expect(models.find((model) => model.id === "sd_2.0_fast_discount_720p")?.capability).toBe("video");
        expect(models.find((model) => model.id === "seedance-2.0")?.capability).toBe("video");
        expect(models.find((model) => model.id === "stable-diffusion-2.0")?.capability).toBe("image");
        expect(models.find((model) => model.id === "sdxl")?.capability).toBe("image");
    });

    it("keeps an explicitly selected logical model capability", () => {
        const channels = [channel("one", ["stable-diffusion-2.0"])];
        const models = normalizeLogicalModelsConfig(
            [{ id: "stable-diffusion-2.0", name: "自定义视频能力", capability: "video", enabled: true, bindings: [{ id: "one", channelId: "one", upstreamModel: "stable-diffusion-2.0", enabled: true, priority: 1 }] }],
            channels,
        );

        expect(models[0]?.capability).toBe("video");
        expect(normalizeDefaultModelsConfig({ textModel: "", imageModel: "", videoModel: "stable-diffusion-2.0", audioModel: "" }, models, channels).videoModel).toBe("stable-diffusion-2.0");
    });

    it("uses channel capability metadata before model-name inference", () => {
        const source = channel("one", ["opaque-a", "stable-video-diffusion"]);
        source.advancedConfig = { modelCapabilities: { "opaque-a": "image", "stable-video-diffusion": "video" } } as never;

        const models = deriveLogicalModelsConfig([source]);

        expect(models.find((model) => model.id === "opaque-a")?.capability).toBe("image");
        expect(models.find((model) => model.id === "stable-video-diffusion")?.capability).toBe("video");
    });

    it("repairs stale health detection for Nano Banana image models", () => {
        const source = channel("sub2api", ["gemini-3.1-flash-image-preview", "nano-banana-2"]);
        source.advancedConfig = {
            modelCapabilities: { "gemini-3.1-flash-image-preview": "text", "nano-banana-2": "text" },
            modelConfigs: {
                "gemini-3.1-flash-image-preview": { capability: "text", source: "health" },
                "nano-banana-2": { capability: "text", source: "health" },
            },
        } as never;

        expect(channelModelCapability(source, "gemini-3.1-flash-image-preview")).toBe("image");
        expect(channelModelCapability(source, "nano-banana-2")).toBe("image");
        expect(Array.from(channelDetectedCapabilities(source))).toEqual(["image"]);
    });

    it("uses refreshed protocol catalog metadata to repair an existing logical capability", () => {
        const source = channel("newapi", ["opaque-media"]);
        source.advancedConfig = {
            protocol: "newapi",
            modelCapabilities: { "opaque-media": "image" },
            modelConfigs: { "opaque-media": { capability: "image", source: "provider" } },
        } as never;
        const existing: LogicalModel[] = [{ id: "opaque-media", name: "opaque-media", capability: "text", enabled: true, bindings: [{ id: "old", channelId: "newapi", upstreamModel: "opaque-media", enabled: true, priority: 1 }] }];

        expect(synchronizeLogicalModelsWithChannels(existing, [source])[0]?.capability).toBe("image");
    });

    it("uses single-capability protocol catalogs for opaque model names", () => {
        const video = channel("seedance", ["opaque-video-model"]);
        video.advancedConfig = { protocol: "seedance" } as never;
        const image = channel("stable-diffusion", ["opaque-image-model"]);
        image.advancedConfig = { protocol: "stable-diffusion" } as never;

        expect(channelModelCapability(video, "opaque-video-model")).toBe("video");
        expect(channelModelCapability(image, "opaque-image-model")).toBe("image");
    });

    it("merges the same upstream model from multiple channels into one logical model", () => {
        const channels = [channel("one", ["models/GPT-IMAGE-2"]), channel("two", ["gpt-image-2"])];
        const existing: LogicalModel[] = [{ id: "gpt-image-2", name: "GPT Image 2", capability: "image", enabled: true, bindings: [{ id: "one:gpt-image-2", channelId: "one", upstreamModel: "gpt-image-2", enabled: true, priority: 1 }] }];

        const models = mergeChannelModelsIntoLogicalModels(existing, channels);

        expect(models).toHaveLength(1);
        expect(models[0].bindings).toEqual([{ ...existing[0].bindings[0], upstreamModel: "models/GPT-IMAGE-2" }, expect.objectContaining({ channelId: "two", upstreamModel: "gpt-image-2" })]);
    });

    it("removes stale bindings and creates separate logical models for different upstream names", () => {
        const channels = [channel("one", ["writer", "writer-mini"]), channel("two", ["models/WRITER"])];
        const existing: LogicalModel[] = [
            {
                id: "custom-writer",
                name: "旧名称",
                capability: "text",
                enabled: false,
                bindings: [
                    { id: "keep", channelId: "one", upstreamModel: "writer", enabled: false, priority: 9, weight: 25 },
                    { id: "stale", channelId: "gone", upstreamModel: "writer", enabled: true, priority: 1 },
                ],
            },
        ];

        const models = synchronizeLogicalModelsWithChannels(existing, channels);

        expect(models).toHaveLength(2);
        expect(models[0]).toMatchObject({ id: "custom-writer", name: "writer", enabled: false });
        expect(models[0].bindings).toEqual([
            expect.objectContaining({ channelId: "two", upstreamModel: "models/WRITER", priority: 2 }),
            expect.objectContaining({ id: "keep", channelId: "one", upstreamModel: "writer", enabled: false, priority: 9, weight: 25 }),
        ]);
        expect(models[1]).toMatchObject({ id: "writer-mini", name: "writer-mini", bindings: [{ channelId: "one", upstreamModel: "writer-mini" }] });
        expect(models.flatMap((model) => model.bindings).some((binding) => binding.channelId === "gone")).toBe(false);
    });

    it("keeps the upstream auto model classified as text", () => {
        const source = channel("one", ["auto"]);
        source.advancedConfig = { modelCapabilities: { auto: "audio" }, modelConfigs: { auto: { capability: "audio", source: "health" } } } as never;

        expect(channelModelCapability(source, "auto")).toBe("text");
    });

    it("only exposes capabilities represented by real channel models", () => {
        const source = channel("one", ["auto", "gpt-5-3", "gpt-image-2"]);

        expect(Array.from(channelDetectedCapabilities(source))).toEqual(["text", "image"]);
    });

    it("requires an enabled matching binding for defaults", () => {
        const channels = [channel("one", ["vendor/writer"]), channel("off", ["voice"], false)];
        const models: LogicalModel[] = [
            { id: "writer", name: "Writer", capability: "text", enabled: true, bindings: [{ id: "one", channelId: "one", upstreamModel: "vendor/writer", enabled: true, priority: 1 }] },
            { id: "voice", name: "Voice", capability: "audio", enabled: true, bindings: [{ id: "two", channelId: "off", upstreamModel: "voice", enabled: true, priority: 1 }] },
        ];
        expect(isLogicalModelResolvable(models, channels, "text", "writer")).toBe(true);
        expect(normalizeDefaultModelsConfig({ textModel: "writer", imageModel: "writer", videoModel: "", audioModel: "voice" }, models, channels)).toEqual({ textModel: "writer", imageModel: "", videoModel: "", audioModel: "" });
    });

    it("switches a stale default to another resolvable model of the same capability", () => {
        const channels = [channel("off", ["gpt-image-2"], false), channel("backup", ["flux-pro"])];
        const models: LogicalModel[] = [
            { id: "gpt-image-2", name: "GPT Image 2", capability: "image", enabled: true, bindings: [{ id: "off", channelId: "off", upstreamModel: "gpt-image-2", enabled: true, priority: 1 }] },
            { id: "flux-pro", name: "Flux Pro", capability: "image", enabled: true, bindings: [{ id: "backup", channelId: "backup", upstreamModel: "flux-pro", enabled: true, priority: 1 }] },
        ];

        expect(normalizeDefaultModelsConfig({ textModel: "", imageModel: "gpt-image-2", videoModel: "", audioModel: "" }, models, channels).imageModel).toBe("flux-pro");
    });

    it("keeps specialized application models out of generic defaults", () => {
        const channels = [channel("one", ["digital-human-v1", "video-v1"])];
        const models: LogicalModel[] = [
            {
                id: "digital-human",
                name: "Digital Human",
                capability: "video",
                enabled: true,
                appKeys: ["aigc-digital-human"],
                bindings: [{ id: "specialized", channelId: "one", upstreamModel: "digital-human-v1", enabled: true, priority: 1 }],
            },
            {
                id: "video",
                name: "Video",
                capability: "video",
                enabled: true,
                bindings: [{ id: "generic", channelId: "one", upstreamModel: "video-v1", enabled: true, priority: 1 }],
            },
        ];
        const defaults = { textModel: "", imageModel: "", videoModel: "digital-human", audioModel: "" };

        expect(normalizeDefaultModelsConfig(defaults, models, channels).videoModel).toBe("video");
        expect(modelRoutingValidationErrors(models, channels, defaults)).toContain("默认视频模型不能使用专项应用模型：digital-human");
    });

    it("uses binding priority and falls back from a disabled channel", () => {
        const channels = [channel("primary", ["writer-v1"], false), channel("backup", ["writer-v2"])];
        const models: LogicalModel[] = [
            {
                id: "writer",
                name: "Writer",
                capability: "text",
                enabled: true,
                bindings: [
                    { id: "one", channelId: "primary", upstreamModel: "writer-v1", enabled: true, priority: 1 },
                    { id: "two", channelId: "backup", upstreamModel: "writer-v2", enabled: true, priority: 2 },
                ],
            },
        ];
        expect(resolveLogicalModelConfig(models, channels, "text", "writer")).toMatchObject({ channel: { id: "backup" }, binding: { upstreamModel: "writer-v2" } });
    });

    it("normalizes binding weight and capability profile limits", () => {
        const channels = [channel("one", ["video-model"])];
        const models = normalizeLogicalModelsConfig(
            [
                {
                    id: "video",
                    name: "Video",
                    capability: "video",
                    enabled: true,
                    bindings: [
                        {
                            id: "one",
                            channelId: "one",
                            upstreamModel: "video-model",
                            enabled: true,
                            priority: 1,
                            weight: 250,
                            capabilityProfile: {
                                supportsReferenceImage: true,
                                maxReferenceImages: 4,
                                aspectRatios: ["16:9", "16:9", "9:16"],
                                maxDurationSeconds: 10,
                                maxBatchSize: 2,
                                timeoutMs: 600000,
                                concurrencyLimit: 3,
                                unitCost: 0.25,
                                unitCostCurrency: "USD",
                            },
                        },
                    ],
                },
            ],
            channels,
        );

        expect(models[0].bindings[0]).toMatchObject({
            weight: 250,
            capabilityProfile: { supportsReferenceImage: true, maxReferenceImages: 4, aspectRatios: ["16:9", "9:16"], maxDurationSeconds: 10, maxBatchSize: 2, timeoutMs: 600000, concurrencyLimit: 3, unitCost: 0.25, unitCostCurrency: "USD" },
        });
    });

    it("reports duplicate bindings and invalid defaults", () => {
        const channels = [channel("one", ["writer"])];
        const models: LogicalModel[] = [
            {
                id: "writer",
                name: "Writer",
                capability: "text",
                enabled: true,
                bindings: [
                    { id: "one", channelId: "one", upstreamModel: "writer", enabled: true, priority: 1 },
                    { id: "two", channelId: "one", upstreamModel: "models/WRITER", enabled: true, priority: 2 },
                ],
            },
        ];
        expect(modelRoutingValidationErrors(models, channels, { textModel: "missing", imageModel: "", videoModel: "", audioModel: "" })).toEqual(expect.arrayContaining(["逻辑模型 writer 存在重复绑定", "默认文本模型不可解析：missing"]));
    });

    it("does not reject an administrator capability override based only on its name", () => {
        const channels = [channel("one", ["stable-diffusion-2.0"])];
        const models: LogicalModel[] = [{ id: "stable-diffusion-2.0", name: "自定义视频能力", capability: "video", enabled: true, bindings: [{ id: "one", channelId: "one", upstreamModel: "stable-diffusion-2.0", enabled: true, priority: 1 }] }];

        expect(modelRoutingValidationErrors(models, channels, { textModel: "", imageModel: "", videoModel: "stable-diffusion-2.0", audioModel: "" })).not.toContain("逻辑模型 stable-diffusion-2.0 更像图片模型，请调整能力类型");
    });
});
