import { describe, expect, it, vi } from "vitest";

import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

import { KlingAvatarProvider } from "./kling-avatar-provider";

const context: SpecializedProviderContext = {
    appKey: "aigc-digital-human",
    logicalModelKey: "kling-avatar",
    upstreamModel: "kling-avatar-v1",
    channelId: "kling-channel",
    baseUrl: "https://api-beijing.klingai.com",
    apiKey: "jwt-token",
    protocol: "kling-avatar-v1",
    timeoutMs: 60_000,
};

function response(payload: Record<string, unknown>) {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

describe("KlingAvatarProvider", () => {
    it("creates an image-to-avatar task using the official request contract", async () => {
        const fetcher = vi.fn().mockResolvedValue(response({ code: 0, data: { task_id: "kling-1", task_status: "submitted" } }));
        const provider = new KlingAvatarProvider(fetcher);

        await expect(
            provider.submitAvatar(
                {
                    localTaskId: "local-1",
                    scriptText: "unused",
                    avatar: { mediaUrl: "https://cdn.example/avatar.png" },
                    voice: { mediaUrl: "https://cdn.example/speech.mp3" },
                    providerParams: { prompt: "Happy presentation", mode: "pro" },
                },
                "https://cdn.example/generated-speech.mp3",
                context,
            ),
        ).resolves.toMatchObject({ taskId: "kling-1" });

        const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api-beijing.klingai.com/v1/videos/avatar/image2video");
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer jwt-token");
        expect(JSON.parse(String(init.body))).toEqual({
            image: "https://cdn.example/avatar.png",
            sound_file: "https://cdn.example/generated-speech.mp3",
            prompt: "Happy presentation",
            mode: "pro",
            external_task_id: "local-1",
        });
    });

    it("queries a single task and extracts the official nested video result", async () => {
        const fetcher = vi.fn().mockResolvedValue(
            response({
                code: 0,
                data: {
                    task_id: "kling-1",
                    task_status: "succeed",
                    task_result: { videos: [{ id: "video-1", url: "https://cdn.example/result.mp4" }] },
                },
            }),
        );
        const provider = new KlingAvatarProvider(fetcher);

        await expect(provider.queryAvatar("kling id/1", context)).resolves.toMatchObject({
            state: "succeeded",
            mediaUrl: "https://cdn.example/result.mp4",
        });
        expect(fetcher.mock.calls[0]?.[0]).toBe("https://api-beijing.klingai.com/v1/videos/avatar/image2video/kling%20id%2F1");
    });

    it("does not expose a synthetic TTS operation for the avatar-only protocol", async () => {
        const provider = new KlingAvatarProvider(vi.fn());
        await expect(
            provider.submitTts(
                {
                    localTaskId: "local-1",
                    scriptText: "Hello",
                    avatar: { mediaUrl: "https://cdn.example/avatar.png" },
                    voice: { mediaUrl: "https://cdn.example/speech.mp3" },
                },
                context,
            ),
        ).rejects.toMatchObject({ protocol: "kling-avatar-v1", operation: "tts" });
    });
});
