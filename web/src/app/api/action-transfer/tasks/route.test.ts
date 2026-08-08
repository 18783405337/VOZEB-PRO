import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    listTasks: vi.fn(),
    createTask: vi.fn(),
    requireActionTransferContext: vi.fn(),
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
vi.mock("@/lib/server/action-transfer/action-transfer-access", () => ({
    requireActionTransferContext: mocks.requireActionTransferContext,
    actionTransferApiError: (error: unknown) => {
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
    title: "Dance",
    referenceImages: ["https://cdn.example/person-1.png", "https://cdn.example/person-2.png"],
    sourceVideo: "https://cdn.example/source.mp4",
    prompt: "Keep the original camera movement",
    mode: "standard",
    faceCount: 2,
    durationSeconds: 12,
    provider: "xhadmin-action-transfer-v1",
    model: "action-transfer",
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

describe("action transfer task API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActionTransferContext.mockResolvedValue({
            user: { id: "user-1" },
            tenantId: "tenant-1",
            repository: { listTasks: mocks.listTasks, createTask: mocks.createTask },
        });
        mocks.listTasks.mockResolvedValue([createdTask]);
        mocks.createTask.mockResolvedValue(createdTask);
        mocks.requireTenantAppRuntime.mockResolvedValue({
            appKey: "action-transfer",
            version: "1.0.0",
            definition: { workflowKey: "action-transfer.v1" },
        });
        mocks.resolveTenantAppProviderCandidates.mockResolvedValue([
            {
                logicalModelId: "action-transfer",
                upstreamModel: "action-transfer-v1",
                channelId: "channel-1",
                channel: { id: "channel-1" },
            },
        ]);
        mocks.resolveSpecializedProviderContext.mockReturnValue({ protocol: "xhadmin-action-transfer-v1" });
        mocks.reserveSpecializedTaskBilling.mockResolvedValue({
            saleAmount: 180,
            costAmount: 72,
            snapshot: { billingMetric: "video-second", quantity: 12 },
        });
        mocks.releaseSpecializedTaskBilling.mockResolvedValue({});
    });

    it("lists only the authenticated tenant user's tasks", async () => {
        const response = await GET(new Request("http://localhost/api/action-transfer/tasks"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.listTasks).toHaveBeenCalledWith("tenant-1", "user-1");
        expect(payload.data.items[0]).not.toHaveProperty("tenantId");
        expect(payload.data.items[0]).not.toHaveProperty("userId");
    });

    it("creates the specialized task and schedules the same generation task ID", async () => {
        const response = await POST(
            new Request("http://localhost/api/action-transfer/tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title: "Dance",
                    referenceImages: ["https://cdn.example/person-1.png", "https://cdn.example/person-2.png"],
                    sourceVideo: "https://cdn.example/source.mp4",
                    prompt: "Keep the original camera movement",
                    mode: "standard",
                    faceCount: 2,
                    duration: 12,
                }),
            }),
        );
        const payload = await response.json();

        expect(response.status).toBe(201);
        expect(mocks.requireTenantAppRuntime).toHaveBeenCalledWith("tenant-1", "action-transfer", "video");
        expect(mocks.createTask).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "task-1",
                tenantId: "tenant-1",
                userId: "user-1",
                referenceImages: ["https://cdn.example/person-1.png", "https://cdn.example/person-2.png"],
                sourceVideo: "https://cdn.example/source.mp4",
                mode: "standard",
                faceCount: 2,
                durationSeconds: 12,
                provider: "xhadmin-action-transfer-v1",
                model: "action-transfer",
            }),
        );
        expect(mocks.createStoredGenerationTask).toHaveBeenCalledWith(
            "action-transfer",
            expect.objectContaining({
                id: "task-1",
                tenantId: "tenant-1",
                type: "action-transfer",
                appKey: "action-transfer",
                appVersion: "1.0.0",
                workflowKey: "action-transfer.v1",
                taskBillingUsage: { saleAmount: 180, costAmount: 72 },
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
        expect(mocks.scheduleGenerationTask).toHaveBeenCalledWith(
            "action-transfer",
            "task-1",
            expect.objectContaining({ channelId: "channel-1", provider: "xhadmin-action-transfer-v1" }),
            { tenantId: "tenant-1" },
        );
        expect(payload.data.task.id).toBe("task-1");
    });
});
