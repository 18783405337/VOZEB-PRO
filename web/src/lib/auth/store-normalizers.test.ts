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
});
