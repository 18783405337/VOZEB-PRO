import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    listTasks: vi.fn(),
    createTask: vi.fn(),
    requireImageHumanContext: vi.fn(),
    requireTenantAppRuntime: vi.fn(),
    resolveTenantAppProviderCandidates: vi.fn(),
    resolveSpecializedProviderContext: vi.fn(),
    createStoredGenerationTask: vi.fn(),
    scheduleGenerationTask: vi.fn(),
    reserveSpecializedTaskBilling: vi.fn(),
    releaseSpecializedTaskBilling: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:crypto")>();
    return { ...actual, randomUUID: () => "task-1" };
});
vi.mock("@/lib/server/image-human/image-human-access", () => ({
    requireImageHumanContext: mocks.requireImageHumanContext,
    imageHumanApiError: (error: unknown) => {
        throw error;
    },
}));
vi.mock("@/lib/server/apps/tenant-app-runtime", () => ({ requireTenantAppRuntime: mocks.requireTenantAppRuntime }));
vi.mock("@/lib/server/apps/specialized-provider-binding-service", () => ({
    SpecializedProviderBindingService: class {
        resolveTenantAppProviderCandidates = mocks.resolveTenantAppProviderCandidates;
    },
}));
vi.mock("@/lib/server/database", () => ({ createPostgresRepositories: vi.fn(() => ({ appCenter: {} })) }));
vi.mock("@/lib/server/specialized-provider/provider-context", () => ({
    resolveSpecializedProviderContext: mocks.resolveSpecializedProviderContext,
}));
vi.mock("@/lib/server/generation-task-store", () => ({ createStoredGenerationTask: mocks.createStoredGenerationTask }));
vi.mock("@/lib/server/generation-task-scheduler", () => ({ scheduleGenerationTask: mocks.scheduleGenerationTask }));
vi.mock("@/lib/server/apps/specialized-task-billing", () => ({
    reserveSpecializedTaskBilling: mocks.reserveSpecializedTaskBilling,
    releaseSpecializedTaskBilling: mocks.releaseSpecializedTaskBilling,
}));

import { GET, POST } from "./route";

const createdTask = {
    id: "task-1",
    tenantId: "tenant-1",
    userId: "user-1",
    title: "Presenter",
    imageUrl: "https://cdn.example/avatar.png",
    audioUrl: "https://cdn.example/voice.mp3",
    scriptText: "Hello",
    prompt: "",
    mode: "standard",
    durationSeconds: 12,
    provider: "xhadmin-image-human-v1",
    model: "image-human",
    providerTaskId: "",
    providerStage: "queued",
    providerPayload: {},
    status: "pending",
    progress: 0,
    error: "",
    resultPayload: {},
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
};

describe("image human task API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireImageHumanContext.mockResolvedValue({
            user: { id: "user-1" },
            tenantId: "tenant-1",
            repository: { listTasks: mocks.listTasks, createTask: mocks.createTask },
        });
        mocks.listTasks.mockResolvedValue([createdTask]);
        mocks.createTask.mockResolvedValue(createdTask);
        mocks.requireTenantAppRuntime.mockResolvedValue({
            appKey: "image-human",
            version: "1.0.0",
            definition: { workflowKey: "image-human.v1" },
        });
        mocks.resolveTenantAppProviderCandidates.mockResolvedValue([
            {
                logicalModelId: "image-human",
                upstreamModel: "image-human-v1",
                channelId: "channel-1",
                channel: { id: "channel-1" },
            },
        ]);
        mocks.resolveSpecializedProviderContext.mockReturnValue({ protocol: "xhadmin-image-human-v1" });
        mocks.reserveSpecializedTaskBilling.mockResolvedValue({
            saleAmount: 144,
            costAmount: 60,
            snapshot: { billingMetric: "video-second", quantity: 12 },
        });
        mocks.releaseSpecializedTaskBilling.mockResolvedValue({});
    });

    it("lists only the authenticated tenant user's tasks", async () => {
        const response = await GET(new Request("http://localhost/api/image-human/tasks"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.listTasks).toHaveBeenCalledWith("tenant-1", "user-1");
        expect(payload.data.items[0]).not.toHaveProperty("tenantId");
        expect(payload.data.items[0]).not.toHaveProperty("userId");
    });

    it("creates the specialized task and schedules the same generation task ID", async () => {
        const response = await POST(
            new Request("http://localhost/api/image-human/tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title: "Presenter",
                    imageUrl: "https://cdn.example/avatar.png",
                    audioUrl: "https://cdn.example/voice.mp3",
                    scriptText: "Hello",
                    duration: 12,
                }),
            }),
        );
        const payload = await response.json();

        expect(response.status).toBe(201);
        expect(mocks.requireTenantAppRuntime).toHaveBeenCalledWith("tenant-1", "image-human", "video");
        expect(mocks.createTask).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "task-1",
                tenantId: "tenant-1",
                userId: "user-1",
                sourceImageUri: "https://cdn.example/avatar.png",
                referenceAudioUri: "https://cdn.example/voice.mp3",
                provider: "xhadmin-image-human-v1",
                model: "image-human",
            }),
        );
        expect(mocks.createStoredGenerationTask).toHaveBeenCalledWith(
            "image-human",
            expect.objectContaining({
                id: "task-1",
                tenantId: "tenant-1",
                type: "image-human",
                appKey: "image-human",
                appVersion: "1.0.0",
                workflowKey: "image-human.v1",
                taskBillingUsage: { saleAmount: 144, costAmount: 60 },
                payload: expect.objectContaining({
                    billingSnapshot: { billingMetric: "video-second", quantity: 12 },
                }),
            }),
            expect.any(Number),
        );
        expect(mocks.reserveSpecializedTaskBilling).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: "tenant-1",
                userId: "user-1",
                generationTaskId: "task-1",
                quantity: 12,
            }),
        );
        expect(mocks.reserveSpecializedTaskBilling.mock.invocationCallOrder[0]).toBeLessThan(mocks.createTask.mock.invocationCallOrder[0]!);
        expect(mocks.scheduleGenerationTask).toHaveBeenCalledWith(
            "image-human",
            "task-1",
            expect.objectContaining({ channelId: "channel-1", provider: "xhadmin-image-human-v1" }),
            { tenantId: "tenant-1" },
        );
        expect(payload.data.task.id).toBe("task-1");
    });

    it("releases the billing reservation when task creation fails", async () => {
        mocks.createTask.mockRejectedValueOnce(new Error("insert failed"));

        await expect(
            POST(
                new Request("http://localhost/api/image-human/tasks", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        imageUrl: "https://cdn.example/avatar.png",
                        audioUrl: "https://cdn.example/voice.mp3",
                        duration: 12,
                    }),
                }),
            ),
        ).rejects.toThrow("insert failed");

        expect(mocks.releaseSpecializedTaskBilling).toHaveBeenCalledWith({
            tenantId: "tenant-1",
            generationTaskId: "task-1",
        });
    });
});
