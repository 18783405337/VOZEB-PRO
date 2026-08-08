import { describe, expect, it, vi } from "vitest";

import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

import { XhadminDigitalHumanProvider } from "./xhadmin-digital-human-provider";

const context: SpecializedProviderContext = {
    appKey: "aigc-digital-human",
    logicalModelKey: "digital-human-pro",
    upstreamModel: "xiaojiayu1.0",
    channelId: "channel-a",
    baseUrl: "https://provider.example.com/gateway",
    apiKey: "secret-key",
    protocol: "xhadmin-digital-human-v1",
    timeoutMs: 30_000,
};

function response(payload: Record<string, unknown>) {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

describe("XhadminDigitalHumanProvider", () => {
    it("submits TTS using the original Xhadmin contract", async () => {
        const fetcher = vi.fn().mockResolvedValue(response({ code: 1, data: { task_id: "tts-1" } }));
        const provider = new XhadminDigitalHumanProvider(fetcher);

        await expect(
            provider.submitTts(
                {
                    localTaskId: "local-1",
                    scriptText: "Hello",
                    avatar: { mediaUrl: "https://cdn.example/avatar.mp4" },
                    voice: { mediaUrl: "https://cdn.example/voice.mp3", providerAssetId: "voice-ref-1" },
                },
                context,
            ),
        ).resolves.toMatchObject({ taskId: "tts-1" });

        const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://provider.example.com/api/v1/apps/voice_tts/tts_live");
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer secret-key");
        expect(JSON.parse(String(init.body))).toEqual({
            text: "Hello",
            model: "s2-pro",
            format: "mp3",
            reference_id: "voice-ref-1",
            normalize: true,
            client_task_id: "local-1",
            idempotency_key: "digital-human:local-1:tts",
            local_task_id: "local-1",
            local_task_sn: "local-1",
        });
    });

    it("polls the shared task endpoint and extracts audio output", async () => {
        const fetcher = vi.fn().mockResolvedValue(response({ code: 1, data: { status: "completed", result: { audio_url: "https://cdn.example/result.mp3" } } }));
        const provider = new XhadminDigitalHumanProvider(fetcher);

        await expect(provider.queryTts("tts id/1", context)).resolves.toMatchObject({
            state: "succeeded",
            mediaUrl: "https://cdn.example/result.mp3",
        });
        expect(fetcher.mock.calls[0]?.[0]).toBe("https://provider.example.com/api/v1/tasks/tts%20id%2F1");
    });

    it("submits lipsync using the generated audio and avatar video", async () => {
        const fetcher = vi.fn().mockResolvedValue(response({ code: 1, task_id: "video-1" }));
        const provider = new XhadminDigitalHumanProvider(fetcher);

        await provider.submitAvatar(
            {
                localTaskId: "local-1",
                scriptText: "Hello",
                avatar: { mediaUrl: "https://cdn.example/avatar.mp4" },
                voice: { mediaUrl: "https://cdn.example/voice.mp3", providerAssetId: "voice-ref-1" },
            },
            "https://cdn.example/result.mp3",
            context,
        );

        const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://provider.example.com/api/v1/apps/lipsync/submit");
        expect(JSON.parse(String(init.body))).toEqual({
            mode: "async_query",
            model: "xiaojiayu1.0",
            audio_url: "https://cdn.example/result.mp3",
            video_url: "https://cdn.example/avatar.mp4",
            client_task_id: "local-1",
            idempotency_key: "digital-human:local-1:lipsync",
            local_task_id: "local-1",
            local_task_sn: "local-1",
        });
    });

    it("keeps provider errors typed and sanitized", async () => {
        const fetcher = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ code: 500, message: "Bearer secret-key failed" }), {
                status: 500,
                headers: { "content-type": "application/json" },
            }),
        );
        const provider = new XhadminDigitalHumanProvider(fetcher);

        await expect(provider.queryAvatar("video-1", context)).rejects.toMatchObject({
            code: "HTTP_ERROR",
            message: expect.not.stringContaining("secret-key"),
        });
    });
});
