import { describe, expect, it, vi } from "vitest";
import { runSmartClipTaskStep } from "./smart-clip-runtime";

const task = { id: "task-1", tenantId: "tenant-a", userId: "user-a", clipType: "broadcast_mixcut" as const, styleId: "style", title: "Demo", videoUri: "https://cdn.example/in.mp4", audioUri: "", materials: [], introduceCard: {}, packRules: {}, processRules: {}, structLayers: [], subtitle: {}, language: "zh", provider: "xhadmin", model: "smart-clip", providerTaskId: "", providerPayload: {}, status: "pending" as const, progress: 0 };

describe("smart clip runtime", () => {
    it("submits a pending task and records the provider task id", async () => {
        const saveTask = vi.fn();
        const provider = { submit: vi.fn().mockResolvedValue({ taskId: "upstream-1", state: "pending", mediaUrl: "", error: "", payload: { accepted: true } }), query: vi.fn() };
        const result = await runSmartClipTaskStep(task, { config: { baseUrl: "https://provider.example", apiKey: "secret", timeoutMs: 10000 }, provider, saveTask });
        expect(result.state).toBe("pending");
        expect(saveTask).toHaveBeenCalledWith(expect.objectContaining({ providerTaskId: "upstream-1", providerPayload: expect.objectContaining({ submission: { accepted: true } }), status: "running" }));
    });

    it("completes a successful provider result after persistence", async () => {
        const provider = { submit: vi.fn(), query: vi.fn().mockResolvedValue({ taskId: "upstream-1", state: "succeeded", mediaUrl: "https://cdn.example/out.mp4", error: "", payload: { status: "completed" } }) };
        const result = await runSmartClipTaskStep({ ...task, providerTaskId: "upstream-1", status: "running", progress: 50 }, { config: { baseUrl: "https://provider.example", apiKey: "secret", timeoutMs: 10000 }, provider, saveTask: vi.fn(), persistResult: vi.fn().mockResolvedValue("/api/generation-log-assets/out.mp4"), completeTask: vi.fn() });
        expect(result.state).toBe("completed");
    });
});
