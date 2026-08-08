import { describe, expect, it } from "vitest";

import type { AuthSettings } from "@/lib/auth/store";

import { localAgentReadiness } from "./admin-generation-settings";

describe("admin generation settings", () => {
    it("does not treat a specialized application model as a ready generic default", () => {
        const settings = {
            defaultModels: {
                textModel: "",
                imageModel: "",
                videoModel: "digital-human",
                audioModel: "",
            },
            logicalModels: [
                {
                    id: "digital-human",
                    name: "Digital Human",
                    capability: "video",
                    enabled: true,
                    appKeys: ["aigc-digital-human"],
                    bindings: [{ id: "binding", channelId: "one", upstreamModel: "digital-human-v1", enabled: true, priority: 1 }],
                },
            ],
            systemChannels: [
                {
                    id: "one",
                    name: "Provider",
                    baseUrl: "https://provider.example.com/v1",
                    apiKey: "secret",
                    apiFormat: "openai",
                    models: ["digital-human-v1"],
                    enabled: true,
                },
            ],
            agentSkills: [],
        } as unknown as AuthSettings;

        expect(localAgentReadiness(settings).capabilities.find((item) => item.type === "video")).toMatchObject({
            ready: false,
            message: "默认模型不能使用专项应用模型",
        });
    });
});
