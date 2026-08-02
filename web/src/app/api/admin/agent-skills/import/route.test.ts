import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), importAgentSkillFromGithub: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/github-agent-skill-import", () => ({
    GithubSkillImportError: class GithubSkillImportError extends Error {
        status = 400;
    },
    importAgentSkillFromGithub: mocks.importAgentSkillFromGithub,
}));

import { POST } from "./route";

describe("POST /api/admin/agent-skills/import", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUser.mockResolvedValue({ id: "admin", role: "admin" });
    });

    it("passes the public URL and selected path to the server importer", async () => {
        mocks.importAgentSkillFromGithub.mockResolvedValue({ repository: "acme/skills", ref: "main", candidates: [], skill: { id: "skill", name: "Skill" } });
        const response = await POST(request({ url: "https://github.com/acme/skills", path: "poster/SKILL.md" }));

        expect(response.status).toBe(200);
        expect(mocks.importAgentSkillFromGithub).toHaveBeenCalledWith({ url: "https://github.com/acme/skills", path: "poster/SKILL.md" });
        await expect(response.json()).resolves.toMatchObject({ code: 0, data: { repository: "acme/skills" } });
    });

    it("rejects an empty URL before reaching the importer", async () => {
        const response = await POST(request({ url: " " }));

        expect(response.status).toBe(400);
        expect(mocks.importAgentSkillFromGithub).not.toHaveBeenCalled();
    });

    it("rejects non-admin users", async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: "user", role: "user" });

        const response = await POST(request({ url: "https://github.com/acme/skills" }));

        expect(response.status).toBe(403);
        expect(mocks.importAgentSkillFromGithub).not.toHaveBeenCalled();
    });
});

function request(body: unknown) {
    return new Request("http://localhost/api/admin/agent-skills/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
