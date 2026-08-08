import { describe, expect, it } from "vitest";

import { resolveSpecializedProviderContext, specializedProviderTaskSnapshot } from "./provider-context";

function candidate(specializedProtocol: unknown) {
    return {
        logicalModelId: "tenant-digital-human",
        upstreamModel: "avatar-v1",
        channelId: "physical-channel-one",
        channel: {
            id: "physical-channel-one",
            name: "Kling production",
            baseUrl: "https://api.example.com",
            apiKey: "provider-secret",
            apiFormat: "openai" as const,
            models: ["avatar-v1"],
            enabled: true,
            advancedConfig: { specializedProtocol },
        },
    };
}

describe("specialized provider context", () => {
    it("resolves an explicit app-compatible physical protocol", () => {
        expect(resolveSpecializedProviderContext(candidate("kling-avatar-v1"), "aigc-digital-human")).toMatchObject({
            logicalModelKey: "tenant-digital-human",
            upstreamModel: "avatar-v1",
            channelId: "physical-channel-one",
            baseUrl: "https://api.example.com",
            apiKey: "provider-secret",
            protocol: "kling-avatar-v1",
        });
    });

    it.each([
        ["unknown-provider", "aigc-digital-human", "UNKNOWN_PROTOCOL"],
        ["xhadmin-image-human-v1", "aigc-digital-human", "APP_PROTOCOL_MISMATCH"],
        ["xhadmin-action-transfer-v1", "image-human", "APP_PROTOCOL_MISMATCH"],
    ] as const)("rejects unknown and app-incompatible protocols before network execution", (protocol, appKey, code) => {
        expect(() => resolveSpecializedProviderContext(candidate(protocol), appKey)).toThrowError(expect.objectContaining({ code }));
    });

    it("creates a task snapshot without credentials, URLs, or physical channel identity", () => {
        const context = resolveSpecializedProviderContext(candidate("kling-avatar-v1"), "aigc-digital-human");

        expect(specializedProviderTaskSnapshot(context)).toEqual({
            logicalModelKey: "tenant-digital-human",
            upstreamModel: "avatar-v1",
            protocol: "kling-avatar-v1",
        });
        expect(JSON.stringify(specializedProviderTaskSnapshot(context))).not.toContain("provider-secret");
        expect(JSON.stringify(specializedProviderTaskSnapshot(context))).not.toContain("physical-channel-one");
        expect(JSON.stringify(specializedProviderTaskSnapshot(context))).not.toContain("api.example.com");
    });
});
