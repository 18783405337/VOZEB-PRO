import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getAuthSettings: vi.fn(),
    setAuthSettings: vi.fn(),
    safeRecordAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => ({ id: "admin", role: "admin" })) }));
vi.mock("@/lib/auth/store", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth/store")>();
    return { ...actual, getAuthSettings: mocks.getAuthSettings, setAuthSettings: mocks.setAuthSettings };
});
vi.mock("@/lib/server/audit-log-store", () => ({ auditActorFromRequest: vi.fn(() => ({ id: "admin" })), safeRecordAuditLog: mocks.safeRecordAuditLog }));

import { PATCH } from "./route";

const savedSettings = {
    systemChannels: [{ id: "one", name: "主渠道", baseUrl: "https://api.example.com/v1", apiKey: "saved-secret", webhookSecret: "0123456789abcdef0123456789abcdef", apiFormat: "openai", models: ["vendor/writer"], enabled: true }],
    logicalModels: [{ id: "writer", name: "Writer", capability: "text", enabled: true, appKeys: ["aigc-digital-human"], bindings: [{ id: "binding", channelId: "one", upstreamModel: "vendor/writer", enabled: true, priority: 1 }] }],
    defaultModels: { textModel: "writer", imageModel: "", videoModel: "", audioModel: "" },
};

describe("admin settings model routing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getAuthSettings.mockResolvedValue(savedSettings);
        mocks.setAuthSettings.mockImplementation(async (patch) => ({ ...savedSettings, ...patch }));
    });

    it("saves a consistent channel, logical model, and default snapshot", async () => {
        const response = await PATCH(
            request({
                systemChannels: [{ ...savedSettings.systemChannels[0], apiKey: "", webhookSecret: "", hasApiKey: true, hasWebhookSecret: true }],
                logicalModels: savedSettings.logicalModels,
                defaultModels: savedSettings.defaultModels,
            }),
        );
        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                systemChannels: [expect.objectContaining({ id: "one", apiKey: "saved-secret", webhookSecret: savedSettings.systemChannels[0].webhookSecret })],
                logicalModels: [expect.objectContaining({ id: "writer", name: "vendor/writer", appKeys: ["aigc-digital-human"], bindings: savedSettings.logicalModels[0].bindings })],
                defaultModels: savedSettings.defaultModels,
            }),
        );
        expect(mocks.safeRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.settings.update", metadata: { fields: expect.arrayContaining(["systemChannels", "logicalModels", "defaultModels"]) } }));
    });

    it("deletes a channel together with stale logical bindings and defaults", async () => {
        const response = await PATCH(request({ systemChannels: [], logicalModels: savedSettings.logicalModels, defaultModels: savedSettings.defaultModels }));
        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(expect.objectContaining({ systemChannels: [], logicalModels: [], defaultModels: { textModel: "", imageModel: "", videoModel: "", audioModel: "" } }));
    });

    it("rebuilds an explicitly empty logical model catalog from channels", async () => {
        const response = await PATCH(request({ logicalModels: [], defaultModels: { ...savedSettings.defaultModels, textModel: "" } }));

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(expect.objectContaining({ logicalModels: [expect.objectContaining({ id: "vendor/writer", bindings: [expect.objectContaining({ channelId: "one", upstreamModel: "vendor/writer" })] })] }));
    });

    it("recreates channel-backed logical models during a later channel-only save", async () => {
        mocks.getAuthSettings.mockResolvedValue({ ...savedSettings, logicalModels: [], defaultModels: { ...savedSettings.defaultModels, textModel: "" } });

        const response = await PATCH(request({ systemChannels: savedSettings.systemChannels }));

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(expect.objectContaining({ logicalModels: [expect.objectContaining({ id: "vendor/writer" })] }));
    });

    it("saves a disabled channel after clearing its now-unresolvable default", async () => {
        const response = await PATCH(
            request({
                systemChannels: [{ ...savedSettings.systemChannels[0], enabled: false, apiKey: "", hasApiKey: true }],
                logicalModels: savedSettings.logicalModels,
                defaultModels: savedSettings.defaultModels,
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.setAuthSettings).toHaveBeenCalledWith(expect.objectContaining({ defaultModels: expect.objectContaining({ textModel: "" }) }));
    });

    it("rejects a newly submitted short webhook secret instead of silently keeping the old value", async () => {
        const response = await PATCH(request({ systemChannels: [{ ...savedSettings.systemChannels[0], apiKey: "", webhookSecret: "short", hasApiKey: true, hasWebhookSecret: true }] }));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual(expect.objectContaining({ error: expect.stringContaining("至少需要 32 个字符") }));
        expect(mocks.setAuthSettings).not.toHaveBeenCalled();
    });
});

function request(body: unknown) {
    return new Request("http://localhost/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
