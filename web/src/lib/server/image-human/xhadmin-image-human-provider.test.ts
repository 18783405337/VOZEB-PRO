import { describe, expect, it, vi } from "vitest";

import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

import { XhadminImageHumanProvider } from "./xhadmin-image-human-provider";

const context: SpecializedProviderContext = {
    appKey: "image-human",
    logicalModelKey: "image-human",
    upstreamModel: "image-human-v1",
    channelId: "channel-1",
    baseUrl: "https://provider.example.com",
    apiKey: "secret",
    protocol: "xhadmin-image-human-v1",
    timeoutMs: 30_000,
};

function response(payload: Record<string, unknown>) {
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
}

describe("XhadminImageHumanProvider", () => {
    it("keeps the original submit contract", async () => {
        const fetcher = vi.fn().mockResolvedValue(response({ code: 1, data: { task_id: "image-task-1" } }));
        const provider = new XhadminImageHumanProvider(fetcher);

        await expect(
            provider.submit(
                {
                    localTaskId: "local-1",
                    imageUrl: "https://cdn.example/avatar.png",
                    audioUrl: "https://cdn.example/voice.mp3",
                    scriptText: "Hello",
                    prompt: "Friendly",
                    duration: 12,
                    mode: "standard",
                    providerParams: { client_task_id: "local-1", payload: { quality: "high" } },
                },
                context,
            ),
        ).resolves.toMatchObject({ taskId: "image-task-1" });

        const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://provider.example.com/api/v1/apps/image_human/submit");
        expect(JSON.parse(String(init.body))).toEqual({
            quality: "high",
            file_url: "https://cdn.example/avatar.png",
            ref_file_url: "https://cdn.example/voice.mp3",
            script_text: "Hello",
            prompt: "Friendly",
            duration: 12,
            mode: "standard",
            client_task_id: "local-1",
        });
    });

    it("queries the provider task and extracts the generated video", async () => {
        const fetcher = vi.fn().mockResolvedValue(
            response({ code: 1, data: { status: "success", result: { videos: [{ url: "https://cdn.example/result.mp4" }] } } }),
        );
        const provider = new XhadminImageHumanProvider(fetcher);

        await expect(provider.query("image-task-1", context)).resolves.toMatchObject({
            state: "succeeded",
            mediaUrl: "https://cdn.example/result.mp4",
        });
        expect(fetcher.mock.calls[0]?.[0]).toBe("https://provider.example.com/api/v1/apps/image_human/query");
        expect(JSON.parse(String((fetcher.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
            task_id: "image-task-1",
            elastic_task_id: "image-task-1",
        });
    });
});
