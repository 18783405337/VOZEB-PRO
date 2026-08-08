import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    AuthorizationError: class AuthorizationError extends Error {
        constructor(message: string, readonly status: number, readonly code: string) {
            super(message);
        }
    },
    disable: vi.fn(),
    list: vi.fn(),
    requireTenantPermission: vi.fn(),
    save: vi.fn(),
}));

vi.mock("@/lib/server/authorization/authorization-service", () => ({
    AuthorizationError: mocks.AuthorizationError,
    requireTenantPermission: mocks.requireTenantPermission,
}));
vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: () => ({ merchantAccounts: {} }),
    isPostgresDatabaseEnabled: () => true,
}));
vi.mock("@/lib/server/payment/merchant-account-service", () => ({
    MerchantAccountService: class {
        list = mocks.list;
        save = mocks.save;
        disable = mocks.disable;
    },
}));

import { DELETE, GET, PUT } from "./route";

describe("tenant merchant account API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_SAAS_ENABLED = "1";
        mocks.requireTenantPermission.mockResolvedValue({ tenant: { id: "tenant-a" }, user: { id: "owner-a" } });
        mocks.list.mockResolvedValue([]);
        mocks.save.mockResolvedValue({ id: "merchant-one", ownerType: "tenant", provider: "stripe", environment: "test", status: "enabled", configuredFields: ["secretKey"] });
        mocks.disable.mockResolvedValue(true);
    });

    it("lists only merchant accounts owned by the resolved tenant", async () => {
        const response = await GET(new Request("https://tenant.example.com/api/tenant/billing/merchant-accounts"));

        expect(response.status).toBe(200);
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Request), "tenant.merchants.manage");
        expect(mocks.list).toHaveBeenCalledWith({ ownerType: "tenant", ownerId: "tenant-a", tenantId: "tenant-a" });
    });

    it("does not trust a tenant id supplied in a merchant save request", async () => {
        const response = await PUT(
            new Request("https://tenant.example.com/api/tenant/billing/merchant-accounts", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    tenantId: "tenant-b",
                    provider: "stripe",
                    environment: "test",
                    credentials: { secretKey: "sk_test_secret" },
                    webhookIdentity: "acct_tenant_a",
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mocks.save).toHaveBeenCalledWith(
            { ownerType: "tenant", ownerId: "tenant-a", tenantId: "tenant-a" },
            {
                provider: "stripe",
                environment: "test",
                credentials: { secretKey: "sk_test_secret" },
                webhookIdentity: "acct_tenant_a",
            },
        );
    });

    it("disables only an account belonging to the resolved tenant", async () => {
        const response = await DELETE(new Request("https://tenant.example.com/api/tenant/billing/merchant-accounts?id=merchant-one", { method: "DELETE" }));

        expect(response.status).toBe(200);
        expect(mocks.disable).toHaveBeenCalledWith({ ownerType: "tenant", ownerId: "tenant-a", tenantId: "tenant-a" }, "merchant-one");
    });
});
