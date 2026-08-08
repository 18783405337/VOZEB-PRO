import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getPublished: vi.fn(),
    publish: vi.fn(),
    requirePlatformPermission: vi.fn(),
}));

const classes = vi.hoisted(() => ({
    AuthorizationError: class AuthorizationError extends Error {
        constructor(
            message: string,
            readonly status: number,
            readonly code: string,
        ) {
            super(message);
        }
    },
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: classes.AuthorizationError,
    requirePlatformPermission: mocks.requirePlatformPermission,
}));

vi.mock("@/lib/server/database", () => ({
    isPostgresDatabaseEnabled: () => true,
    createPostgresRepositories: () => ({
        appCenter: {
            getPublished: mocks.getPublished,
            publish: mocks.publish,
        },
    }),
}));

import { POST } from "./route";

describe("platform application publication API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_APP_CENTER_ENABLED = "1";
        mocks.requirePlatformPermission.mockResolvedValue({ user: { id: "admin-one", role: "admin" } });
        mocks.getPublished.mockResolvedValue(null);
        mocks.publish.mockResolvedValue({
            id: "version-a",
            appId: "app-a",
            appKey: "background-removal",
            version: "1.0.0",
            definition: { key: "background-removal", version: "1.0.0" },
            publishedAt: 1,
        });
    });

    it("requires platform publication permission before writing", async () => {
        mocks.requirePlatformPermission.mockRejectedValue(new classes.AuthorizationError("登录后继续", 401, "auth.required"));

        const response = await POST(
            new Request("https://admin.example.com/api/admin/apps/background-removal/versions", {
                method: "POST",
                body: JSON.stringify({ version: "1.0.0", definition: { executable: "blocked" } }),
            }),
            { params: Promise.resolve({ appKey: "background-removal" }) },
        );

        expect(response.status).toBe(401);
        expect(mocks.publish).not.toHaveBeenCalled();
    });

    it("publishes the reviewed version without accepting executable request definitions", async () => {
        const response = await POST(
            new Request("https://admin.example.com/api/admin/apps/background-removal/versions", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ version: "1.0.0", definition: { executable: "blocked" } }),
            }),
            { params: Promise.resolve({ appKey: "background-removal" }) },
        );

        expect(response.status).toBe(201);
        expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ definition: expect.objectContaining({ key: "background-removal", version: "1.0.0" }) }));
        expect(mocks.publish.mock.calls[0]?.[0].definition.executable).toBeUndefined();
    });
});
