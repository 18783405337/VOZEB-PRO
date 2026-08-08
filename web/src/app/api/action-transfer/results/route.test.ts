import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    listResults: vi.fn(),
    requireActionTransferContext: vi.fn(),
}));

vi.mock("@/lib/server/action-transfer/action-transfer-access", () => ({
    requireActionTransferContext: mocks.requireActionTransferContext,
    actionTransferApiError: (error: unknown) => {
        throw error;
    },
}));

import { GET } from "./route";

describe("action transfer results API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActionTransferContext.mockResolvedValue({
            user: { id: "user-1" },
            tenantId: "tenant-1",
            repository: { listResults: mocks.listResults },
        });
        mocks.listResults.mockResolvedValue([
            {
                id: "result-1",
                tenantId: "tenant-1",
                userId: "user-1",
                taskId: "task-1",
                videoUri: "https://cdn.example/result.mp4",
            },
        ]);
    });

    it("lists only the authenticated tenant user's results", async () => {
        const response = await GET(new Request("http://localhost/api/action-transfer/results"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.listResults).toHaveBeenCalledWith("tenant-1", "user-1");
        expect(payload.data.items[0]).not.toHaveProperty("tenantId");
        expect(payload.data.items[0]).not.toHaveProperty("userId");
    });
});
