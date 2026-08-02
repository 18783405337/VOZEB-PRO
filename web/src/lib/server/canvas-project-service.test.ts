import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CanvasProject } from "@/lib/canvas-project-contract";

const mocks = vi.hoisted(() => ({
    createCreativeConversation: vi.fn(),
    updateCreativeConversation: vi.fn(),
    createCanvasProject: vi.fn(),
    deleteCanvasProjects: vi.fn(),
    getCanvasProject: vi.fn(),
    listCanvasProjectSummaries: vi.fn(),
    updateCanvasProject: vi.fn(),
    deleteUserLocalMediaAssets: vi.fn(),
}));

vi.mock("@/lib/server/creative-runtime-store", () => ({ createCreativeConversation: mocks.createCreativeConversation, updateCreativeConversation: mocks.updateCreativeConversation }));
vi.mock("@/lib/server/canvas-project-store", () => ({
    CanvasProjectStoreError: class CanvasProjectStoreError extends Error {},
    createCanvasProject: mocks.createCanvasProject,
    deleteCanvasProjects: mocks.deleteCanvasProjects,
    getCanvasProject: mocks.getCanvasProject,
    listCanvasProjectSummaries: mocks.listCanvasProjectSummaries,
    updateCanvasProject: mocks.updateCanvasProject,
}));
vi.mock("@/lib/server/local-media-storage", () => ({ deleteUserLocalMediaAssets: mocks.deleteUserLocalMediaAssets }));

import { createCanvasProjectForUser, deleteCanvasProjectsForUser } from "./canvas-project-service";

describe("canvas project service lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createCreativeConversation.mockResolvedValue({ id: "conversation-new" });
        mocks.updateCreativeConversation.mockResolvedValue({ id: "conversation-new", status: "archived" });
        mocks.getCanvasProject.mockResolvedValue(null);
    });

    it("archives the new conversation when project creation fails", async () => {
        const error = new Error("write failed");
        mocks.createCanvasProject.mockRejectedValue(error);

        await expect(createCanvasProjectForUser("user-one", { title: "画布" })).rejects.toBe(error);

        expect(mocks.updateCreativeConversation).toHaveBeenCalledWith("conversation-new", "user-one", { status: "archived" });
    });

    it("reuses a source handoff project through its stable primary key", async () => {
        const existing = { ...project(), id: "canvas-handoff-one", sourceHandoffId: "handoff-one" };
        mocks.getCanvasProject.mockResolvedValue(existing);

        await expect(createCanvasProjectForUser("user-one", { sourceHandoffId: "handoff-one" })).resolves.toEqual(existing);

        expect(mocks.getCanvasProject).toHaveBeenCalledWith("canvas-handoff-one", "user-one");
        expect(mocks.createCreativeConversation).not.toHaveBeenCalled();
        expect(mocks.createCanvasProject).not.toHaveBeenCalled();
    });

    it("archives linked conversations after deleting projects", async () => {
        mocks.getCanvasProject.mockResolvedValue(project());
        mocks.deleteCanvasProjects.mockResolvedValue(1);

        await deleteCanvasProjectsForUser("user-one", ["canvas-one"]);

        expect(mocks.updateCreativeConversation).toHaveBeenCalledWith("conversation-one", "user-one", { status: "archived" });
        expect(mocks.deleteUserLocalMediaAssets).toHaveBeenCalled();
    });
});

function project(): CanvasProject {
    const now = new Date().toISOString();
    return {
        id: "canvas-one",
        title: "画布",
        creativeConversationId: "conversation-one",
        nodes: [],
        connections: [],
        chatSessions: [],
        activeChatId: null,
        backgroundMode: "lines",
        showImageInfo: false,
        viewport: { x: 0, y: 0, k: 1 },
        createdAt: now,
        updatedAt: now,
    };
}
