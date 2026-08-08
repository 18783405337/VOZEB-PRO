import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createTask: vi.fn(),
    listTasks: vi.fn(),
    listVoices: vi.fn(),
    requireDigitalHumanContext: vi.fn(),
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
vi.mock("@/lib/server/digital-human/digital-human-access", () => ({
    requireDigitalHumanContext: mocks.requireDigitalHumanContext,
    digitalHumanApiError: (error: unknown) => {
        throw error;
    },
}));
vi.mock("@/lib/server/apps/tenant-app-runtime", () => ({ requireTenantAppRuntime: mocks.requireTenantAppRuntime }));
vi.mock("@/lib/server/apps/specialized-provider-binding-service", () => ({
    SpecializedProviderBindingService: class {
        resolveTenantAppProviderCandidates = mocks.resolveTenantAppProviderCandidates;
    },
}));
vi.mock("@/lib/server/apps/specialized-task-billing", () => ({
    reserveSpecializedTaskBilling: mocks.reserveSpecializedTaskBilling,
    releaseSpecializedTaskBilling: mocks.releaseSpecializedTaskBilling,
}));
vi.mock("@/lib/server/database", () => ({ createPostgresRepositories: vi.fn(() => ({ appCenter: {} })) }));
vi.mock("@/lib/server/specialized-provider/provider-context", () => ({
    resolveSpecializedProviderContext: mocks.resolveSpecializedProviderContext,
}));
vi.mock("@/lib/server/generation-task-store", () => ({ createStoredGenerationTask: mocks.createStoredGenerationTask }));
vi.mock("@/lib/server/generation-task-scheduler", () => ({ scheduleGenerationTask: mocks.scheduleGenerationTask }));

import { POST } from "./route";

const createdTask = {
    id: "task-1",
    tenantId: "tenant-1",
    userId: "user-1",
    avatarId: "avatar-1",
    voiceId: "voice-1",
    title: "Presenter",
    scriptText: "Hello",
    prompt: "",
    mode: "standard",
    ratio: "16:9",
    provider: "kling-avatar-v1",
    model: "digital-human",
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

describe("digital human task API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireDigitalHumanContext.mockResolvedValue({
            user: { id: "user-1" },
            tenantId: "tenant-1",
            repository: {
                createTask: mocks.createTask,
                listTasks: mocks.listTasks,
                listVoices: mocks.listVoices,
            },
        });
        mocks.createTask.mockResolvedValue(createdTask);
        mocks.listVoices.mockResolvedValue([{ id: "voice-1", durationSeconds: 12.2 }]);
        mocks.requireTenantAppRuntime.mockResolvedValue({
            appKey: "aigc-digital-human",
            version: "1.0.0",
            definition: { workflowKey: "aigc-digital-human.v1" },
        });
        mocks.resolveTenantAppProviderCandidates.mockResolvedValue([
            {
                logicalModelId: "digital-human",
                upstreamModel: "kling-avatar",
                channelId: "channel-1",
                channel: { id: "channel-1" },
            },
        ]);
        mocks.resolveSpecializedProviderContext.mockReturnValue({ protocol: "kling-avatar-v1" });
        mocks.reserveSpecializedTaskBilling.mockResolvedValue({
            saleAmount: 130,
            costAmount: 65,
            snapshot: { billingMetric: "video-second", quantity: 13 },
        });
        mocks.releaseSpecializedTaskBilling.mockResolvedValue({});
    });

    it("reserves by selected voice duration and stores the application billing context", async () => {
        const response = await POST(
            new Request("http://localhost/api/digital-human/tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    avatarId: "avatar-1",
                    voiceId: "voice-1",
                    title: "Presenter",
                    scriptText: "Hello",
                }),
            }),
        );

        expect(response.status).toBe(201);
        expect(mocks.requireTenantAppRuntime).toHaveBeenCalledWith("tenant-1", "aigc-digital-human", "video");
        expect(mocks.reserveSpecializedTaskBilling).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: "tenant-1",
                userId: "user-1",
                generationTaskId: "task-1",
                quantity: 13,
            }),
        );
        expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
        expect(mocks.createStoredGenerationTask).toHaveBeenCalledWith(
            "digital-human",
            expect.objectContaining({
                appKey: "aigc-digital-human",
                appVersion: "1.0.0",
                workflowKey: "aigc-digital-human.v1",
                taskBillingUsage: { saleAmount: 130, costAmount: 65 },
                payload: expect.objectContaining({
                    billingSnapshot: { billingMetric: "video-second", quantity: 13 },
                }),
            }),
            expect.any(Number),
        );
    });
});
