import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
}));

vi.mock("@/lib/server/secret-crypto", () => ({
    encryptSecretValue: mocks.encrypt,
}));

import { MerchantAccountService } from "./merchant-account-service";

describe("MerchantAccountService", () => {
    const repository = {
        disable: vi.fn(),
        list: vi.fn(),
        save: vi.fn(),
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
});
