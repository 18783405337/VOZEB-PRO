import { describe, expect, it, vi } from "vitest";

import type { SpecializedProviderContext } from "@/lib/server/specialized-provider/provider-types";

import { XhadminActionTransferProvider } from "./xhadmin-action-transfer-provider";

const context: SpecializedProviderContext = {
    appKey: "action-transfer",
    logicalModelKey: "action-transfer",
    upstreamModel: "action-transfer-v1",
    channelId: "channel-1",
    baseUrl: "https://provider.example.com",
    apiKey: "secret",
    protocol: "xhadmin-action-transfer-v1",
    timeoutMs: 30_000,
};

function response(payload: Record<string, unknown>) {
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
}

describe("XhadminActionTransferProvider", () => {
    it("submits the original action transfer payload shape", async () => {
        const fetcher = vi.fn().mockResolvedValue(response({ code: 0, data: { task_id: "action-task-1" } }));
        const provider = new XhadminActionTransferProvider(fetcher);

        await expect(
            provider.submit(
                {
                    localTaskId: "local-1",
                    referenceImageUrls: ["https://cdn.example/person-1.png", "https://cdn.example/person-2.png"],
                    sourceVideoUrl: "https://cdn.example/motion.mp4",
                    prompt: "Keep the original camera movement",
                    mode: "standard",
                    faceCount: 2,
                    duration: 12,
                },
                context,
            ),
        ).resolves.toMatchObject({ taskId: "action-task-1" });

        const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://provider.example.com/api/v1/apps/action_transfer/submit");
        expect(JSON.parse(String(init.body))).toEqual({
            type: "action_transfer",
            file_url: ["https://cdn.example/person-1.png", "https://cdn.example/person-2.png"],
            video_url: "https://cdn.example/motion.mp4",
            prompt: "Keep the original camera movement",
            mode: "standard",
            face_count: 2,
            duration: 12,
        });
    });

    it("queries and extracts the provider video result", async () => {
        const fetcher = vi.fn().mockResolvedValue(
            response({ code: 0, data: { result: { status: "success", data: { video_url: "https://cdn.example/result.mp4" } } } }),
        );
        const provider = new XhadminActionTransferProvider(fetcher);

        await expect(provider.query("action-task-1", context)).resolves.toMatchObject({
            state: "succeeded",
            mediaUrl: "https://cdn.example/result.mp4",
        });
        expect(fetcher.mock.calls[0]?.[0]).toBe("https://provider.example.com/api/v1/apps/action_transfer/query");
    });
});
