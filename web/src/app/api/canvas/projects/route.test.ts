import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createProject: vi.fn(),
    getCurrentUser: vi.fn(),
    getTrustedTenantId: vi.fn(),
    listProjects: vi.fn(),
    requireTenantMembership: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/authorization/authorization-service", () => ({ requireTenantMembership: mocks.requireTenantMembership }));
vi.mock("@/lib/server/canvas-project-service", () => ({
    canvasProjectError: vi.fn(),
    createCanvasProjectForUser: mocks.createProject,
    deleteCanvasProjectsForUser: vi.fn(),
    listCanvasProjectsForUser: mocks.listProjects,
}));
vi.mock("@/lib/server/tenant/tenant-context", () => ({ getTrustedTenantId: mocks.getTrustedTenantId }));

import { GET, POST } from "./route";

describe("canvas projects route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.getTrustedTenantId.mockResolvedValue("default");
        mocks.listProjects.mockResolvedValue({ projects: [{ id: "canvas-one", title: "画布一", nodeCount: 3, connectionCount: 1 }], total: 21, page: 2, pageSize: 12 });
        mocks.createProject.mockResolvedValue({ id: "canvas-new", title: "新画布" });
        mocks.requireTenantMembership.mockRejectedValue(new Error("single-tenant canvas creation must not require SaaS membership"));
    });

    it("returns lightweight project summaries", async () => {
        const response = await GET(new Request("http://localhost/api/canvas/projects?page=2&pageSize=12"));

        expect(mocks.listProjects).toHaveBeenCalledWith("user-one", { page: "2", pageSize: "12" });
        expect(await response.json()).toEqual({ code: 0, data: { projects: [{ id: "canvas-one", title: "画布一", nodeCount: 3, connectionCount: 1 }], total: 21, page: 2, pageSize: 12 }, msg: "OK" });
    });

    it("creates a project in the trusted default tenant when SaaS is disabled", async () => {
        const request = new Request("http://localhost/api/canvas/projects", {
            method: "POST",
            body: JSON.stringify({ title: "新画布" }),
            headers: { "Content-Type": "application/json" },
        });

        const response = await POST(request);

        expect(mocks.getTrustedTenantId).toHaveBeenCalledWith(request, { id: "user-one" });
        expect(mocks.createProject).toHaveBeenCalledWith("user-one", { title: "新画布" }, "default");
        expect(mocks.requireTenantMembership).not.toHaveBeenCalled();
        expect(await response.json()).toEqual({ code: 0, data: { project: { id: "canvas-new", title: "新画布" } }, msg: "画布项目已创建" });
    });
});
