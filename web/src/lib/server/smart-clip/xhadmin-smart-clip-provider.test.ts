import { describe, expect, it, vi } from "vitest";
import { XhadminSmartClipProvider } from "./xhadmin-smart-clip-provider";

const context = { baseUrl: "https://provider.example.com", apiKey: "secret", timeoutMs: 10_000 };
const response = (payload: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" }, ...init });

describe("XhadminSmartClipProvider", () => {
    it("submits a type-specific payload and extracts the provider task id", async () => {
        const fetcher = vi.fn().mockResolvedValue(response({ code: 0, data: { task_id: "provider-1", status: "queued" } }));
        const provider = new XhadminSmartClipProvider(fetcher);
        await expect(provider.submit({ clipType: "broadcast_mixcut", styleId: "style-1", title: "Demo", videoUrl: "https://cdn.example/video.mp4", audioUrl: "", language: "zh", materials: ["https://cdn.example/a.mp4"], introduceCard: {}, packRules: {}, processRules: {}, structLayers: [], subtitle: {} }, context)).resolves.toMatchObject({ taskId: "provider-1", state: "pending" });
        expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toMatchObject({ styleId: "style-1", videoUrl: "https://cdn.example/video.mp4", materials: ["https://cdn.example/a.mp4"] });
    });

    it("queries a completed task and extracts the video URL", async () => {
        const fetcher = vi.fn().mockResolvedValue(response({ data: { status: "completed", result: { video_url: "https://cdn.example/result.mp4" } } }));
        await expect(new XhadminSmartClipProvider(fetcher).query("provider-1", context)).resolves.toMatchObject({ taskId: "provider-1", state: "succeeded", mediaUrl: "https://cdn.example/result.mp4" });
        expect(fetcher.mock.calls[0]?.[0]).toContain("/api/v1/tasks/provider-1");
    });
});
