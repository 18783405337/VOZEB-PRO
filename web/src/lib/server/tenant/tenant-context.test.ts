import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getById: vi.fn(),
    getBySlug: vi.fn(),
    getByVerifiedHostname: vi.fn(),
    getCurrentUser: vi.fn(),
    getMember: vi.fn(),
    isPostgresDatabaseEnabled: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
    createPostgresRepositories: () => ({
        tenants: {
            getById: mocks.getById,
            getBySlug: mocks.getBySlug,
            getByVerifiedHostname: mocks.getByVerifiedHostname,
            getMember: mocks.getMember,
        },
    }),
    isPostgresDatabaseEnabled: mocks.isPostgresDatabaseEnabled,
}));

vi.mock("@/lib/auth/session", () => ({
    getCurrentUser: mocks.getCurrentUser,
}));

import type { TenantMemberRecord, TenantRecord } from "./tenant-types";
import { getTenantContext, getTrustedTenantId, TenantContextError } from "./tenant-context";

const timestamp = "2026-08-07T00:00:00.000Z";
const originalSaasEnabled = process.env.VOZEB_PRO_SAAS_ENABLED;

function tenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
    return {
        id: "tenant-one",
        slug: "tenant-one",
        name: "Tenant One",
        status: "active",
        settings: {},
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides,
    };
}

function member(overrides: Partial<TenantMemberRecord> = {}): TenantMemberRecord {
    return {
        tenantId: "tenant-one",
        userId: "user-one",
        roleId: "role-member",
        roleKey: "member",
        status: "active",
        permissions: ["tenant.apps.read"],
        joinedAt: timestamp,
        updatedAt: timestamp,
        ...overrides,
    };
}

describe("getTenantContext", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VOZEB_PRO_SAAS_ENABLED = "1";
        mocks.isPostgresDatabaseEnabled.mockReturnValue(true);
        mocks.getCurrentUser.mockResolvedValue(null);
        mocks.getByVerifiedHostname.mockResolvedValue(null);
        mocks.getBySlug.mockResolvedValue(null);
        mocks.getById.mockResolvedValue(null);
        mocks.getMember.mockResolvedValue(null);
    });

    it("keeps tenant administration disabled unless the SaaS flag is enabled", async () => {
        process.env.VOZEB_PRO_SAAS_ENABLED = "0";

        await expect(getTenantContext(new Request("https://tenant.example.com/api/apps"))).rejects.toMatchObject({
            code: "tenant.saas_disabled",
            status: 501,
        });
        expect(mocks.getByVerifiedHostname).not.toHaveBeenCalled();
    });

    it("keeps existing single-tenant generation routes on the default tenant while SaaS is disabled", async () => {
        process.env.VOZEB_PRO_SAAS_ENABLED = "0";

        await expect(getTrustedTenantId(new Request("https://public.example.com/api/image-tasks"), { id: "user-one" })).resolves.toBe("default");
        expect(mocks.getByVerifiedHostname).not.toHaveBeenCalled();
    });

    it("prefers a verified domain over a tenant path", async () => {
        mocks.getByVerifiedHostname.mockResolvedValue(tenant());

        const context = await getTenantContext(new Request("https://tenant.example.com/t/other/apps"));

        expect(context).toMatchObject({ tenant: { id: "tenant-one" }, source: "domain" });
        expect(mocks.getBySlug).not.toHaveBeenCalled();
        expect(mocks.getById).not.toHaveBeenCalled();
    });

    it("falls back from an unknown domain to a tenant path", async () => {
        mocks.getBySlug.mockResolvedValue(tenant());

        const context = await getTenantContext(new Request("https://public.example.com/t/tenant-one/apps"));

        expect(context.source).toBe("path");
        expect(mocks.getByVerifiedHostname).toHaveBeenCalledWith("public.example.com");
        expect(mocks.getBySlug).toHaveBeenCalledWith("tenant-one");
    });

    it("rejects a disabled tenant resolved by a verified domain without default fallback", async () => {
        mocks.getByVerifiedHostname.mockResolvedValue(tenant({ status: "disabled" }));
        mocks.getById.mockResolvedValue(tenant({ id: "default", slug: "default" }));

        await expect(getTenantContext(new Request("https://disabled.example.com/api/apps"))).rejects.toMatchObject({
            code: "tenant.not_found",
            status: 404,
        });
        expect(mocks.getById).not.toHaveBeenCalled();
    });

    it("uses the configured default tenant after domain and path misses", async () => {
        mocks.getById.mockResolvedValue(tenant({ id: "default", slug: "default" }));

        const context = await getTenantContext(new Request("https://public.example.com/api/apps"), {
            defaultTenantId: "default",
        });

        expect(context).toMatchObject({ tenant: { id: "default" }, source: "default" });
    });

    it("treats a platform admin as owner of an unowned bootstrap default tenant", async () => {
        mocks.getById.mockResolvedValue(tenant({ id: "default", slug: "default", ownerUserId: undefined }));
        const context = await getTenantContext(new Request("https://public.example.com/api/apps"), { user: { id: "admin-one", role: "admin" }, requireMembership: true });
        expect(context.member).toMatchObject({ tenantId: "default", userId: "admin-one", roleKey: "owner", status: "active" });
    });

    it("can disable default tenant fallback", async () => {
        await expect(
            getTenantContext(new Request("https://public.example.com/api/apps"), {
                allowDefault: false,
                defaultTenantId: "default",
            }),
        ).rejects.toBeInstanceOf(TenantContextError);
        expect(mocks.getById).not.toHaveBeenCalled();
    });

    it("loads the active tenant membership for the current user", async () => {
        mocks.getByVerifiedHostname.mockResolvedValue(tenant());
        mocks.getCurrentUser.mockResolvedValue({ id: "user-one" });
        mocks.getMember.mockResolvedValue(member());

        const context = await getTenantContext(new Request("https://tenant.example.com/api/apps"), {
            requireMembership: true,
        });

        expect(context.member).toMatchObject({ userId: "user-one", tenantId: "tenant-one" });
        expect(mocks.getMember).toHaveBeenCalledWith("tenant-one", "user-one");
    });

    it("rejects missing or disabled required membership", async () => {
        mocks.getByVerifiedHostname.mockResolvedValue(tenant());

        await expect(
            getTenantContext(new Request("https://tenant.example.com/api/apps"), {
                requireMembership: true,
                user: { id: "user-one" },
            }),
        ).rejects.toMatchObject({ code: "tenant.membership_required", status: 403 });

        mocks.getMember.mockResolvedValue(member({ status: "disabled" }));
        await expect(
            getTenantContext(new Request("https://tenant.example.com/api/apps"), {
                requireMembership: true,
                user: { id: "user-one" },
            }),
        ).rejects.toMatchObject({ code: "tenant.membership_required", status: 403 });
    });

    it("requires PostgreSQL for tenant isolation", async () => {
        mocks.isPostgresDatabaseEnabled.mockReturnValue(false);

        await expect(getTenantContext(new Request("https://tenant.example.com/api/apps"))).rejects.toMatchObject({
            code: "tenant.postgres_required",
            status: 501,
        });
        await expect(getTrustedTenantId(new Request("https://tenant.example.com/api/image-tasks"), { id: "user-one" })).rejects.toMatchObject({
            code: "tenant.postgres_required",
            status: 501,
        });
        expect(mocks.getByVerifiedHostname).not.toHaveBeenCalled();
    });
});

afterEach(() => {
    if (originalSaasEnabled === undefined) delete process.env.VOZEB_PRO_SAAS_ENABLED;
    else process.env.VOZEB_PRO_SAAS_ENABLED = originalSaasEnabled;
});
