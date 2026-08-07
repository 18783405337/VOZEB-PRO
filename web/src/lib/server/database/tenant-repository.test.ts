import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "./postgres";
import { createPostgresRepositories } from "./repositories";
import { TenantRepository, type TenantTransactionRunner } from "./tenant-repository";

function queryResult(rows: Record<string, unknown>[] = [], rowCount = rows.length) {
    return { rows, rowCount };
}

describe("TenantRepository", () => {
    it("loads tenants by id and case-insensitive slug", async () => {
        const timestamp = "2026-08-07T00:00:00.000Z";
        const row = {
            id: "tenant-a",
            slug: "tenant-a",
            name: "Tenant A",
            status: "active",
            settings: {},
            created_at: timestamp,
            updated_at: timestamp,
        };
        const query = vi
            .fn()
            .mockResolvedValueOnce(queryResult([row]))
            .mockResolvedValueOnce(queryResult([row]));
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await expect(repository.getById("tenant-a")).resolves.toMatchObject({ id: "tenant-a" });
        await expect(repository.getBySlug(" Tenant-A ")).resolves.toMatchObject({ slug: "tenant-a" });
        expect(query.mock.calls[0]).toEqual(["SELECT * FROM tenants WHERE id = $1", ["tenant-a"]]);
        expect(query.mock.calls[1]).toEqual(["SELECT * FROM tenants WHERE lower(slug) = lower($1)", ["Tenant-A"]]);
    });

    it("updates only the requested tenant status", async () => {
        const timestamp = "2026-08-07T00:00:00.000Z";
        const query = vi.fn().mockResolvedValue(
            queryResult([
                {
                    id: "tenant-a",
                    slug: "tenant-a",
                    name: "Tenant A",
                    status: "disabled",
                    settings: {},
                    created_at: timestamp,
                    updated_at: timestamp,
                },
            ]),
        );
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await expect(repository.updateStatus("tenant-a", "disabled")).resolves.toMatchObject({ id: "tenant-a", status: "disabled" });
        expect(query).toHaveBeenCalledWith("UPDATE tenants SET status = $2 WHERE id = $1 RETURNING *", ["tenant-a", "disabled"]);
    });

    it("lists a filtered page of tenants with a separate total", async () => {
        const timestamp = "2026-08-07T00:00:00.000Z";
        const query = vi
            .fn()
            .mockResolvedValueOnce(queryResult([{ total: "3" }]))
            .mockResolvedValueOnce(
                queryResult([
                    {
                        id: "tenant-a",
                        slug: "tenant-a",
                        name: "Tenant A",
                        status: "disabled",
                        settings: {},
                        created_at: timestamp,
                        updated_at: timestamp,
                    },
                ]),
            );
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await expect(repository.list({ page: 2, pageSize: 10, keyword: "Studio", status: "disabled" })).resolves.toMatchObject({
            items: [{ id: "tenant-a", status: "disabled" }],
            total: 3,
            page: 2,
            pageSize: 10,
        });
        expect(query.mock.calls[0]?.[0]).toContain("lower(name) LIKE $1 OR lower(slug) LIKE $1");
        expect(query.mock.calls[0]?.[0]).toContain("status = $2");
        expect(query.mock.calls[0]?.[1]).toEqual(["%studio%", "disabled"]);
        expect(query.mock.calls[1]?.[1]).toEqual(["%studio%", "disabled", 10, 10]);
    });

    it("renames only the requested tenant", async () => {
        const timestamp = "2026-08-07T00:00:00.000Z";
        const query = vi.fn().mockResolvedValue(
            queryResult([
                {
                    id: "tenant-a",
                    slug: "tenant-a",
                    name: "Renamed",
                    status: "active",
                    settings: {},
                    created_at: timestamp,
                    updated_at: timestamp,
                },
            ]),
        );
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await expect(repository.updateName("tenant-a", " Renamed ")).resolves.toMatchObject({ id: "tenant-a", name: "Renamed" });
        expect(query).toHaveBeenCalledWith("UPDATE tenants SET name = $2 WHERE id = $1 RETURNING *", ["tenant-a", "Renamed"]);
    });

    it("always scopes member lookups by tenant", async () => {
        const query = vi.fn().mockResolvedValue(queryResult());
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await repository.getMember("tenant-a", "user-one");

        expect(query).toHaveBeenCalledWith(expect.stringContaining("tm.tenant_id = $1 AND tm.user_id = $2"), ["tenant-a", "user-one"]);
    });

    it("scopes role lookups and lists to the resolved tenant", async () => {
        const query = vi.fn().mockResolvedValue(queryResult());
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await repository.getRole("tenant-a", "role-one");
        await repository.listRoles("tenant-a");

        expect(query.mock.calls[0]).toEqual([expect.stringContaining("tr.tenant_id = $1 AND tr.id = $2"), ["tenant-a", "role-one"]]);
        expect(query.mock.calls[1]).toEqual([expect.stringContaining("WHERE tr.tenant_id = $1"), ["tenant-a"]]);
    });

    it("creates a tenant role and its permissions in one transaction", async () => {
        const timestamp = "2026-08-07T00:00:00.000Z";
        const query = vi
            .fn()
            .mockResolvedValueOnce(
                queryResult([
                    {
                        id: "role-editor",
                        tenant_id: "tenant-a",
                        key: "editor",
                        name: "Editor",
                        system: false,
                        created_at: timestamp,
                        updated_at: timestamp,
                    },
                ]),
            )
            .mockResolvedValueOnce(queryResult());
        const transaction = vi.fn(async (handler: Parameters<TenantTransactionRunner>[0]) => handler({ query } as unknown as QueryExecutor));
        const repository = new TenantRepository({ query: vi.fn() } as unknown as QueryExecutor, transaction as unknown as TenantTransactionRunner);

        await expect(
            repository.createRole({
                id: "role-editor",
                tenantId: "tenant-a",
                key: "editor",
                name: "Editor",
                permissions: ["tenant.apps.read", "tenant.apps.configure"],
            }),
        ).resolves.toMatchObject({
            id: "role-editor",
            tenantId: "tenant-a",
            key: "editor",
            permissions: ["tenant.apps.read", "tenant.apps.configure"],
        });
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0]?.[0]).toContain("INSERT INTO tenant_roles");
        expect(query.mock.calls[1]?.[0]).toContain("INSERT INTO tenant_role_permissions");
        expect(query.mock.calls[1]?.[1]).toEqual(["tenant-a", "role-editor", ["tenant.apps.read", "tenant.apps.configure"]]);
    });

    it("rejects permissions outside the tenant permission catalog before opening a transaction", async () => {
        const transaction = vi.fn();
        const repository = new TenantRepository({ query: vi.fn() } as unknown as QueryExecutor, transaction as unknown as TenantTransactionRunner);

        await expect(
            repository.createRole({
                tenantId: "tenant-a",
                key: "admin",
                name: "Admin",
                permissions: ["platform.tenants.manage"],
            }),
        ).rejects.toThrow("Unsupported tenant permission");
        expect(transaction).not.toHaveBeenCalled();
    });

    it("looks up verified hostnames without hiding disabled tenants from context checks", async () => {
        const timestamp = "2026-08-07T00:00:00.000Z";
        const query = vi.fn().mockResolvedValue(
            queryResult([
                {
                    id: "tenant-a",
                    slug: "tenant-a",
                    name: "Tenant A",
                    status: "active",
                    owner_user_id: "owner-one",
                    settings: { locale: "zh-CN" },
                    created_at: timestamp,
                    updated_at: timestamp,
                },
            ]),
        );
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await expect(repository.getByVerifiedHostname("A.Example.COM")).resolves.toMatchObject({
            id: "tenant-a",
            ownerUserId: "owner-one",
            settings: { locale: "zh-CN" },
        });
        expect(query).toHaveBeenCalledWith(expect.stringContaining("td.status = 'verified'"), ["a.example.com"]);
        expect(query.mock.calls[0]?.[0]).not.toContain("t.status = 'active'");
    });

    it("creates a tenant, owner role, permissions, and membership in one transaction", async () => {
        const timestamp = "2026-08-07T00:00:00.000Z";
        const query = vi
            .fn()
            .mockResolvedValueOnce(
                queryResult([
                    {
                        id: "tenant-a",
                        slug: "tenant-a",
                        name: "Tenant A",
                        status: "active",
                        owner_user_id: "owner-one",
                        settings: {},
                        created_at: timestamp,
                        updated_at: timestamp,
                    },
                ]),
            )
            .mockResolvedValueOnce(queryResult())
            .mockResolvedValueOnce(queryResult())
            .mockResolvedValueOnce(queryResult());
        const transaction = vi.fn(async (handler: Parameters<TenantTransactionRunner>[0]) => handler({ query } as unknown as QueryExecutor));
        const repository = new TenantRepository({ query: vi.fn() } as unknown as QueryExecutor, transaction as unknown as TenantTransactionRunner);

        const tenant = await repository.createWithOwner({
            id: "tenant-a",
            ownerRoleId: "tenant-a-owner",
            slug: "tenant-a",
            name: "Tenant A",
            ownerUserId: "owner-one",
        });

        expect(tenant.id).toBe("tenant-a");
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledTimes(4);
        expect(query.mock.calls[0]?.[0]).toContain("INSERT INTO tenants");
        expect(query.mock.calls[1]?.[0]).toContain("INSERT INTO tenant_roles");
        expect(query.mock.calls[2]?.[0]).toContain("INSERT INTO tenant_role_permissions");
        expect(query.mock.calls[2]?.[1]).toEqual(["tenant-a", "tenant-a-owner", ["tenant.members.read", "tenant.members.manage", "tenant.roles.manage", "tenant.apps.read", "tenant.apps.configure", "tenant.billing.read", "tenant.merchants.manage"]]);
        expect(query.mock.calls[3]?.[0]).toContain("INSERT INTO tenant_members");
    });

    it("propagates a failed owner setup through the transaction runner", async () => {
        const transaction = vi.fn(async (handler: Parameters<TenantTransactionRunner>[0]) => {
            const query = vi
                .fn()
                .mockResolvedValueOnce(queryResult([{ id: "tenant-a" }]))
                .mockResolvedValueOnce(queryResult())
                .mockRejectedValueOnce(new Error("permission write failed"));
            return handler({ query } as unknown as QueryExecutor);
        });
        const repository = new TenantRepository({ query: vi.fn() } as unknown as QueryExecutor, transaction as unknown as TenantTransactionRunner);

        await expect(
            repository.createWithOwner({
                id: "tenant-a",
                ownerRoleId: "tenant-a-owner",
                slug: "tenant-a",
                name: "Tenant A",
                ownerUserId: "owner-one",
            }),
        ).rejects.toThrow("permission write failed");
        expect(transaction).toHaveBeenCalledTimes(1);
    });

    it("lists members with permissions inside the requested tenant", async () => {
        const timestamp = "2026-08-07T00:00:00.000Z";
        const query = vi.fn().mockResolvedValue(
            queryResult([
                {
                    tenant_id: "tenant-a",
                    user_id: "user-one",
                    role_id: "role-one",
                    role_key: "member",
                    status: "active",
                    permissions: ["tenant.apps.read"],
                    joined_at: timestamp,
                    updated_at: timestamp,
                },
            ]),
        );
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await expect(repository.listMembers("tenant-a")).resolves.toMatchObject([{ tenantId: "tenant-a", userId: "user-one", permissions: ["tenant.apps.read"] }]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE tm.tenant_id = $1"), ["tenant-a"]);
    });

    it("adds a member only through a role owned by the same tenant", async () => {
        const timestamp = "2026-08-07T00:00:00.000Z";
        const query = vi
            .fn()
            .mockResolvedValueOnce(queryResult([{ tenant_id: "tenant-a", user_id: "user-two" }]))
            .mockResolvedValueOnce(
                queryResult([
                    {
                        tenant_id: "tenant-a",
                        user_id: "user-two",
                        role_id: "role-member",
                        role_key: "member",
                        status: "active",
                        permissions: [],
                        joined_at: timestamp,
                        updated_at: timestamp,
                    },
                ]),
            );
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await expect(repository.addMember({ tenantId: "tenant-a", userId: "user-two", roleId: "role-member", status: "active" })).resolves.toMatchObject({
            tenantId: "tenant-a",
            userId: "user-two",
            roleId: "role-member",
        });
        expect(query.mock.calls[0]?.[0]).toContain("FROM tenant_roles");
        expect(query.mock.calls[0]?.[0]).toContain("tr.tenant_id = $1 AND tr.id = $3");
        expect(query.mock.calls[0]?.[1]).toEqual(["tenant-a", "user-two", "role-member", "active"]);
    });

    it("rejects a member write when the role is outside the tenant", async () => {
        const query = vi.fn().mockResolvedValue(queryResult());
        const repository = new TenantRepository({ query } as unknown as QueryExecutor);

        await expect(repository.addMember({ tenantId: "tenant-a", userId: "user-two", roleId: "tenant-b-role" })).rejects.toThrow("Tenant role was not found");
        expect(query).toHaveBeenCalledTimes(1);
    });

    it("exports tenants from the shared repository factory", () => {
        const query = vi.fn().mockResolvedValue(queryResult());

        expect(createPostgresRepositories({ query } as unknown as QueryExecutor).tenants).toBeInstanceOf(TenantRepository);
    });
});
