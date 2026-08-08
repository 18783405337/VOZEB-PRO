import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
    decrypt: vi.fn((value: string) => value.replace(/^encrypted:/, "")),
}));

vi.mock("@/lib/server/secret-crypto", () => ({
    encryptSecretValue: mocks.encrypt,
    decryptSecretValue: mocks.decrypt,
}));

import { MerchantAccountService } from "./merchant-account-service";

describe("MerchantAccountService", () => {
    const repository = {
        disable: vi.fn(),
        list: vi.fn(),
        save: vi.fn(),
        getById: vi.fn(),
        getEnabled: vi.fn(),
        getEnabledByWebhookIdentity: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        repository.save.mockResolvedValue({
            id: "merchant-one",
            ownerType: "tenant",
            ownerId: "tenant-a",
            tenantId: "tenant-a",
            provider: "stripe",
            environment: "test",
            status: "enabled",
            encryptedConfig: "encrypted:secret",
            configuredFields: ["secretKey", "webhookSecret"],
            webhookIdentity: "acct_tenant_a",
            createdAt: 1,
            updatedAt: 1,
        });
    });

    it("encrypts the complete credential payload and returns only a redacted summary", async () => {
        const service = new MerchantAccountService(repository);

        const result = await service.save(
            { ownerType: "tenant", ownerId: "tenant-a", tenantId: "tenant-a" },
            {
                provider: "stripe",
                environment: "test",
                credentials: { secretKey: "sk_test_secret", webhookSecret: "whsec_secret" },
                webhookIdentity: "acct_tenant_a",
            },
        );

        expect(mocks.encrypt).toHaveBeenCalledWith('{"secretKey":"sk_test_secret","webhookSecret":"whsec_secret"}');
        expect(repository.save).toHaveBeenCalledWith(
            expect.objectContaining({
                ownerType: "tenant",
                ownerId: "tenant-a",
                tenantId: "tenant-a",
                encryptedConfig: 'encrypted:{"secretKey":"sk_test_secret","webhookSecret":"whsec_secret"}',
                configuredFields: ["secretKey", "webhookSecret"],
            }),
        );
        expect(result).toEqual({
            id: "merchant-one",
            ownerType: "tenant",
            provider: "stripe",
            environment: "test",
            status: "enabled",
            configuredFields: ["secretKey", "webhookSecret"],
        });
        expect(result).not.toHaveProperty("encryptedConfig");
        expect(result).not.toHaveProperty("webhookIdentity");
        expect(JSON.stringify(result)).not.toContain("sk_test_secret");
    });

    it("rejects credentials that are not defined by the selected provider", async () => {
        const service = new MerchantAccountService(repository);

        await expect(
            service.save(
                { ownerType: "platform", ownerId: "platform" },
                {
                    provider: "stripe",
                    environment: "production",
                    credentials: { unexpectedSecret: "do-not-save" },
                    webhookIdentity: "acct_platform",
                },
            ),
        ).rejects.toThrow("Unsupported credential field");

        expect(repository.save).not.toHaveBeenCalled();
    });

    it("lists configured field metadata without decrypting merchant credentials", async () => {
        repository.list.mockResolvedValueOnce([
            {
                id: "merchant-one",
                ownerType: "tenant",
                ownerId: "tenant-a",
                tenantId: "tenant-a",
                provider: "stripe",
                environment: "test",
                status: "enabled",
                encryptedConfig: "encrypted:secret",
                configuredFields: ["secretKey", "webhookSecret"],
                webhookIdentity: "acct_tenant_a",
                createdAt: 1,
                updatedAt: 1,
            },
        ]);
        const service = new MerchantAccountService(repository);

        await expect(service.list({ ownerType: "tenant", ownerId: "tenant-a", tenantId: "tenant-a" })).resolves.toEqual([
            {
                id: "merchant-one",
                ownerType: "tenant",
                provider: "stripe",
                environment: "test",
                status: "enabled",
                configuredFields: ["secretKey", "webhookSecret"],
            },
        ]);
        expect(mocks.encrypt).not.toHaveBeenCalled();
    });

    it("decrypts only the selected account for checkout and returns credentials to the server", async () => {
        repository.getById.mockResolvedValue({
            id: "merchant-one",
            ownerType: "tenant",
            ownerId: "tenant-a",
            tenantId: "tenant-a",
            provider: "stripe",
            environment: "test",
            status: "enabled",
            encryptedConfig: "encrypted:{\"secretKey\":\"sk_test_secret\"}",
            configuredFields: ["secretKey"],
            webhookIdentity: "acct_tenant_a",
            createdAt: 1,
            updatedAt: 1,
        });
        const service = new MerchantAccountService(repository);

        await expect(
            service.resolveForCheckout({
                id: "merchant-one",
                scope: { ownerType: "tenant", ownerId: "tenant-a", tenantId: "tenant-a" },
                provider: "stripe",
                environment: "test",
            }),
        ).resolves.toMatchObject({ id: "merchant-one", credentials: { secretKey: "sk_test_secret" } });
        expect(mocks.decrypt).toHaveBeenCalledWith("encrypted:{\"secretKey\":\"sk_test_secret\"}");
    });

    it("resolves webhook credentials only from an enabled provider identity", async () => {
        repository.getEnabledByWebhookIdentity.mockResolvedValue({
            id: "merchant-one",
            ownerType: "tenant",
            ownerId: "tenant-a",
            tenantId: "tenant-a",
            provider: "stripe",
            environment: "test",
            status: "enabled",
            encryptedConfig: "encrypted:{\"webhookSecret\":\"whsec_tenant_a\"}",
            configuredFields: ["webhookSecret"],
            webhookIdentity: "acct_tenant_a",
            createdAt: 1,
            updatedAt: 1,
        });
        const service = new MerchantAccountService(repository);

        await expect(
            service.resolveForWebhook({
                provider: "stripe",
                environment: "test",
                webhookIdentity: "acct_tenant_a",
            }),
        ).resolves.toMatchObject({
            id: "merchant-one",
            tenantId: "tenant-a",
            credentials: { webhookSecret: "whsec_tenant_a" },
        });
        expect(repository.getEnabledByWebhookIdentity).toHaveBeenCalledWith("stripe", "test", "acct_tenant_a");
    });
});
