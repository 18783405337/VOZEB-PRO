import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getTask: vi.fn(),
    requireActionTransferContext: vi.fn(),
}));

vi.mock("@/lib/server/action-transfer/action-transfer-access", () => ({
    requireActionTransferContext: mocks.requireActionTransferContext,
    actionTransferApiError: (error: unknown) => {
        throw error;
    },
}));

import { GET } from "./route";

describe("action transfer task detail API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActionTransferContext.mockResolvedValue({
            user: { id: "user-1" },
            tenantId: "tenant-1",
            repository: { getTask: mocks.getTask },
        });
        mocks.getTask.mockResolvedValue({
            id: "task-1",
            tenantId: "tenant-1",
            userId: "user-1",
            title: "Dance",
            status: "running",
        });
    });

    it("loads the task through tenant and user ownership", async () => {
        const response = await GET(new Request("http://localhost/api/action-transfer/tasks/task-1"), {
            params: Promise.resolve({ id: "task-1" }),
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.getTask).toHaveBeenCalledWith("tenant-1", "user-1", "task-1");
        expect(payload.data.task).not.toHaveProperty("tenantId");
        expect(payload.data.task).not.toHaveProperty("userId");
    });

    it("returns 404 when the owned task does not exist", async () => {
        mocks.getTask.mockResolvedValue(null);

        const response = await GET(new Request("http://localhost/api/action-transfer/tasks/missing"), {
            params: Promise.resolve({ id: "missing" }),
        });

        expect(response.status).toBe(404);
    });
});
