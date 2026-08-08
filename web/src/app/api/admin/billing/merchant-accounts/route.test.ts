import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    AuthorizationError: class AuthorizationError extends Error {
        constructor(message: string, readonly status: number, readonly code: string) {
            super(message);
        }
    },
    list: vi.fn(),
    requirePlatformPermission: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: mocks.AuthorizationError,
    requirePlatformPermission: mocks.requirePlatformPermission,
}));
vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: () => ({ merchantAccounts: {} }),
    isPostgresDatabaseEnabled: () => true,
}));
vi.mock("@/lib/server/payment/merchant-account-service", () => ({
    MerchantAccountService: class {
        list = mocks.list;
    },
}));

import { GET } from "./route";

describe("platform merchant account API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_SAAS_ENABLED = "1";
        mocks.requirePlatformPermission.mockResolvedValue({ user: { id: "admin-one", role: "admin" } });
        mocks.list.mockResolvedValue([]);
    });

    it("requires platform billing management and never exposes tenant merchant accounts", async () => {
        const response = await GET(new Request("https://platform.example.com/api/admin/billing/merchant-accounts"));

        expect(response.status).toBe(200);
        expect(mocks.requirePlatformPermission).toHaveBeenCalledWith(expect.any(Request), "platform.billing.manage");
        expect(mocks.list).toHaveBeenCalledWith({ ownerType: "platform", ownerId: "platform" });
    });
});
