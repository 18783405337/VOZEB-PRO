import { describe, expect, it, vi } from "vitest";

import { MerchantAccountRepository } from "./merchant-account-repository";

describe("MerchantAccountRepository", () => {
    it("serializes an owner/provider/environment and disables the previous enabled account before saving", async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: "merchant-new",
                        owner_type: "tenant",
                        owner_id: "tenant-a",
                        tenant_id: "tenant-a",
                        provider: "stripe",
                        environment: "test",
                        status: "enabled",
                        encrypted_config: "ciphertext",
                        configured_fields_json: ["secretKey", "webhookSecret"],
                        webhook_identity: "acct_tenant_a",
                        created_at: 1,
                        updated_at: 1,
                    },
                ],
            });
        const repository = new MerchantAccountRepository({ query });

        await repository.save({
            id: "merchant-new",
            ownerType: "tenant",
            ownerId: "tenant-a",
            tenantId: "tenant-a",
            provider: "stripe",
            environment: "test",
            status: "enabled",
            encryptedConfig: "ciphertext",
            configuredFields: ["secretKey", "webhookSecret"],
            webhookIdentity: "acct_tenant_a",
        });

        expect(query.mock.calls[0]?.[0]).toContain("pg_advisory_xact_lock");
        expect(query.mock.calls[1]?.[0]).toContain("SET status = 'disabled'");
        expect(query.mock.calls[1]?.[1]).toEqual(["tenant", "tenant-a", "stripe", "test", "merchant-new", expect.any(Number)]);
        expect(query.mock.calls[2]?.[0]).toContain("INSERT INTO merchant_accounts");
    });

    it("scopes disable operations to the supplied owner", async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const repository = new MerchantAccountRepository({ query });

        await repository.disable({ id: "merchant-one", ownerType: "tenant", ownerId: "tenant-a" });

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("WHERE id = $1 AND owner_type = $2 AND owner_id = $3"),
            ["merchant-one", "tenant", "tenant-a", expect.any(Number)],
        );
    });

    it("loads the enabled account for an exact owner, provider, and environment", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [
                {
                    id: "merchant-tenant",
                    owner_type: "tenant",
                    owner_id: "tenant-a",
                    tenant_id: "tenant-a",
                    provider: "stripe",
                    environment: "production",
                    status: "enabled",
                    encrypted_config: "ciphertext",
                    configured_fields_json: ["secretKey"],
                    webhook_identity: "acct_tenant_a",
                    created_at: 1,
                    updated_at: 2,
                },
            ],
        });
        const repository = new MerchantAccountRepository({ query });

        const account = await repository.getEnabled(
            { ownerType: "tenant", ownerId: "tenant-a", tenantId: "tenant-a" },
            "stripe",
            "production",
        );

        expect(account?.id).toBe("merchant-tenant");
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("owner_type = $1"),
            ["tenant", "tenant-a", "tenant-a", "stripe", "production"],
        );
    });

    it("loads a merchant by id for checkout-time lineage validation", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [
                {
                    id: "merchant-one",
                    owner_type: "platform",
                    owner_id: "platform",
                    provider: "manual",
                    environment: "production",
                    status: "enabled",
                    encrypted_config: "{}",
                    webhook_identity: "manual",
                    created_at: 1,
                    updated_at: 1,
                },
            ],
        });
        const repository = new MerchantAccountRepository({ query });

        await repository.getById("merchant-one");

        expect(query).toHaveBeenCalledWith("SELECT * FROM merchant_accounts WHERE id = $1", ["merchant-one"]);
    });

    it("loads an enabled merchant by provider-controlled webhook identity", async () => {
        const query = vi.fn().mockResolvedValue({
            rows: [
                {
                    id: "merchant-one",
                    owner_type: "tenant",
                    owner_id: "tenant-a",
                    tenant_id: "tenant-a",
                    provider: "stripe",
                    environment: "production",
                    status: "enabled",
                    encrypted_config: "ciphertext",
                    webhook_identity: "acct_tenant_a",
                    created_at: 1,
                    updated_at: 1,
                },
            ],
        });
        const repository = new MerchantAccountRepository({ query });

        await repository.getEnabledByWebhookIdentity("stripe", "production", "acct_tenant_a");

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("webhook_identity = $3"),
            ["stripe", "production", "acct_tenant_a"],
        );
    });
});
