import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CanvasProject } from "@/lib/canvas-project-contract";

const mocks = vi.hoisted(() => ({
    createCreativeConversation: vi.fn(),
    createCanvasProject: vi.fn(),
    deleteCanvasProjectAggregates: vi.fn(),
    getCanvasProject: vi.fn(),
    listCanvasProjectSummaries: vi.fn(),
    updateCanvasProject: vi.fn(),
    deleteUserLocalMediaAssets: vi.fn(),
}));

vi.mock("@/lib/server/creative-runtime-store", () => ({ createCreativeConversation: mocks.createCreativeConversation }));
vi.mock("@/lib/server/canvas-project-store", () => ({
    CanvasProjectStoreError: class CanvasProjectStoreError extends Error {},
    createCanvasProject: mocks.createCanvasProject,
    getCanvasProject: mocks.getCanvasProject,
    listCanvasProjectSummaries: mocks.listCanvasProjectSummaries,
    updateCanvasProject: mocks.updateCanvasProject,
}));
vi.mock("@/lib/server/creative-entity-deletion-store", () => ({
    deleteCanvasProjectAggregates: mocks.deleteCanvasProjectAggregates,
}));
vi.mock("@/lib/server/local-media-storage", () => ({ deleteUserLocalMediaAssets: mocks.deleteUserLocalMediaAssets }));

import { createCanvasProjectForUser, deleteCanvasProjectsForUser, updateCanvasProjectForUser } from "./canvas-project-service";

describe("canvas project service lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createCreativeConversation.mockResolvedValue({ id: "conversation-new" });
        mocks.deleteCanvasProjectAggregates.mockResolvedValue({ deletedConversations: 1, deletedProjects: 1, mediaStorageKeys: ["permanent/canvas.png"] });
        mocks.getCanvasProject.mockResolvedValue(null);
    });

    it("deletes the new conversation when project creation fails", async () => {
        const error = new Error("write failed");
        mocks.createCanvasProject.mockRejectedValue(error);

        await expect(createCanvasProjectForUser("user-one", { title: "画布" })).rejects.toBe(error);

        expect(mocks.deleteCanvasProjectAggregates).toHaveBeenCalledWith("user-one", [expect.stringMatching(/^canvas-/)]);
    });

    it("reuses a source handoff project through its stable primary key", async () => {
        const existing = { ...project(), id: "canvas-handoff-one", sourceHandoffId: "handoff-one" };
        mocks.getCanvasProject.mockResolvedValue(existing);

        await expect(createCanvasProjectForUser("user-one", { sourceHandoffId: "handoff-one" })).resolves.toEqual(existing);

        expect(mocks.getCanvasProject).toHaveBeenCalledWith("canvas-handoff-one", "user-one");
        expect(mocks.createCreativeConversation).not.toHaveBeenCalled();
        expect(mocks.createCanvasProject).not.toHaveBeenCalled();
    });

    it("deletes linked conversations and reclaims only unreferenced media after deleting projects", async () => {
        await deleteCanvasProjectsForUser("user-one", ["canvas-one"]);

        expect(mocks.deleteCanvasProjectAggregates).toHaveBeenCalledWith("user-one", ["canvas-one"]);
        expect(mocks.deleteUserLocalMediaAssets).toHaveBeenCalledWith("user-one", ["permanent/canvas.png"]);
    });

    it("passes the explicit server version to the conditional store update", async () => {
        const current = project();
        mocks.getCanvasProject.mockResolvedValue(current);
        mocks.updateCanvasProject.mockResolvedValue({ ...current, title: "新标题" });

        await updateCanvasProjectForUser("user-one", current.id, { project: { ...current, title: "新标题" }, expectedUpdatedAt: current.updatedAt });

        expect(mocks.updateCanvasProject).toHaveBeenCalledWith("user-one", expect.objectContaining({ title: "新标题" }), current.updatedAt);
    });

    it("always advances the persisted version beyond the current snapshot", async () => {
        const current = { ...project(), updatedAt: "2099-01-01T00:00:00.000Z" };
        mocks.getCanvasProject.mockResolvedValue(current);
        mocks.updateCanvasProject.mockImplementation(async (_userId, next) => next);

        await updateCanvasProjectForUser("user-one", current.id, { project: { ...current, title: "新标题" }, expectedUpdatedAt: current.updatedAt });

        const saved = mocks.updateCanvasProject.mock.calls[0][1] as CanvasProject;
        expect(Date.parse(saved.updatedAt)).toBeGreaterThan(Date.parse(current.updatedAt));
    });

    it("rejects saves without a valid base version", async () => {
        await expect(updateCanvasProjectForUser("user-one", "canvas-one", { project: project() })).rejects.toMatchObject({ status: 400 });
        expect(mocks.getCanvasProject).not.toHaveBeenCalled();
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
