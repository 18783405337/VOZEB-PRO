import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "./store-foundation";
import { normalizeSettings } from "./store-normalizers";

describe("auth settings normalization", () => {
    it("keeps reviewed specialized application scopes through settings round-trips", () => {
        const settings = normalizeSettings({
            ...DEFAULT_SETTINGS,
            systemChannels: [
                {
                    id: "channel-one",
                    name: "Specialized provider",
                    baseUrl: "https://provider.example.com",
                    apiKey: "test-secret",
                    apiFormat: "openai",
                    models: ["digital-human-v1"],
                    enabled: true,
                },
            ],
            logicalModels: [
                {
                    id: "digital-human",
                    name: "Digital Human",
                    capability: "video",
                    enabled: true,
                    appKeys: ["aigc-digital-human", "aigc-digital-human", "invalid-app"] as never,
                    bindings: [{ id: "binding-one", channelId: "channel-one", upstreamModel: "digital-human-v1", enabled: true, priority: 1 }],
                },
            ],
        });
        expect(settings.logicalModels[0]?.appKeys).toEqual(["aigc-digital-human"]);
    });

    it("keeps only reviewed specialized provider protocols on physical channels", () => {
        const settings = normalizeSettings({
            ...DEFAULT_SETTINGS,
            systemChannels: [
                {
                    id: "channel-one",
                    name: "Kling avatar",
                    baseUrl: "https://provider.example.com",
                    apiKey: "test-secret",
                    apiFormat: "openai",
                    models: ["avatar-v1"],
                    enabled: true,
                    advancedConfig: {
                        protocol: "custom",
                        specializedProtocol: "kling-avatar-v1",
                    } as never,
                },
                {
                    id: "channel-two",
                    name: "Unknown specialized protocol",
                    baseUrl: "https://provider.example.com",
                    apiKey: "test-secret",
                    apiFormat: "openai",
                    models: ["avatar-v2"],
                    enabled: true,
                    advancedConfig: {
                        protocol: "custom",
                        specializedProtocol: "unreviewed-provider",
                    } as never,
                },
            ],
        });

        expect(settings.systemChannels[0]?.advancedConfig).toMatchObject({ specializedProtocol: "kling-avatar-v1" });
        expect(settings.systemChannels[1]?.advancedConfig).not.toHaveProperty("specializedProtocol");
    });
});
