import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    listPublished: vi.fn(),
    requirePlatformPermission: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: class AuthorizationError extends Error {},
    requirePlatformPermission: mocks.requirePlatformPermission,
}));

vi.mock("@/lib/server/database", () => ({
    isPostgresDatabaseEnabled: () => true,
    createPostgresRepositories: () => ({
        appCenter: {
            listPublished: mocks.listPublished,
        },
    }),
}));

import { GET } from "./route";

const previousAppCenterEnabled = process.env.VOZEB_PRO_APP_CENTER_ENABLED;

describe("platform application catalog API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_APP_CENTER_ENABLED = "1";
        mocks.requirePlatformPermission.mockResolvedValue({ user: { id: "admin-one", role: "admin" } });
        mocks.listPublished.mockResolvedValue([]);
    });

    afterEach(() => {
        if (previousAppCenterEnabled === undefined) delete process.env.VOZEB_PRO_APP_CENTER_ENABLED;
        else process.env.VOZEB_PRO_APP_CENTER_ENABLED = previousAppCenterEnabled;
    });

    it("returns 501 before authorization when the application center is disabled", async () => {
        process.env.VOZEB_PRO_APP_CENTER_ENABLED = "0";

        const response = await GET(new Request("https://admin.example.com/api/admin/apps"));

        expect(response.status).toBe(501);
        expect(mocks.requirePlatformPermission).not.toHaveBeenCalled();
    });

    it("lists reviewed applications with publication state", async () => {
        const response = await GET(new Request("https://admin.example.com/api/admin/apps"));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.code).toBe(0);
        expect(body.data.apps).toEqual(expect.arrayContaining([expect.objectContaining({ appKey: "background-removal", published: false })]));
        expect(mocks.requirePlatformPermission).toHaveBeenCalledWith(expect.any(Request), "platform.apps.publish");
        expect(mocks.listPublished).toHaveBeenCalledTimes(1);
    });
});
