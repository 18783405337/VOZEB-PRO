import { describe, expect, it, vi } from "vitest";

import type { AppDefinition } from "@/lib/apps/app-definition";
import { resolveLogicalModelCapabilityProfile } from "@/lib/model-routing-config";
import type { TenantAppDetails } from "@/lib/server/database/app-center-repository";
import type { ResolvedLogicalModel } from "@/lib/server/logical-model-router";

import {
    releaseSpecializedTaskBilling,
    reserveSpecializedTaskBilling,
    type SpecializedTaskBillingDependencies,
} from "./specialized-task-billing";

function tenantApp(overrides: Partial<TenantAppDetails> = {}): TenantAppDetails {
    return {
        id: "tenant-app-one",
        tenantId: "tenant-one",
        appId: "app-one",
        appKey: "image-human",
        version: "1.0.0",
        status: "enabled",
        installedBy: "admin-one",
        installedAt: 1,
        updatedAt: 2,
        definition: {
            key: "image-human",
            version: "1.0.0",
            name: "Image Human",
            category: "video",
            capabilities: ["image-human"],
            permissions: ["tenant.apps.use.image-human"],
            inputSchema: [],
            outputSchema: { kind: "video" },
            workflowKey: "image-human.v1",
            billingMetric: "video-second",
            defaultPricing: { currency: "POINT", saleUnit: "second", saleAmount: 12 },
            renderer: { kind: "custom", key: "image-human-result" },
        } satisfies AppDefinition,
        settings: {},
        secretRefs: {},
        pricing: {
            currency: "POINT",
            saleUnit: "second",
            saleAmount: 15,
            collectionMode: "tenant",
            updatedBy: "admin-one",
            updatedAt: 3,
        },
        ...overrides,
    };
}

function candidate(): ResolvedLogicalModel {
    return {
        logicalModelId: "image-human-pro",
        upstreamModel: "avatar-v2",
        channelId: "channel-one",
        channel: {
            id: "channel-one",
            name: "Primary",
            baseUrl: "https://provider.example.com",
            apiKey: "secret",
            apiFormat: "openai",
            models: ["avatar-v2"],
            enabled: true,
        },
        capabilityProfile: resolveLogicalModelCapabilityProfile(
            {
                capabilityProfile: {
                    unitCost: 6.5,
                    unitCostCurrency: "POWER",
                },
            },
            "video",
        ),
    };
}

function dependencies(): SpecializedTaskBillingDependencies {
    return {
        accounts: {
            wallet: { getOrCreateAccount: vi.fn().mockResolvedValue({ id: "wallet-one" }) },
            power: { getOrCreateAccount: vi.fn().mockResolvedValue({ id: "power-one" }) },
        },
        billing: {
            reserve: vi.fn().mockResolvedValue({ status: "reserved" }),
            release: vi.fn().mockResolvedValue({ status: "released" }),
        },
    };
}

describe("specialized task billing", () => {
    it("reserves tenant sale points and provider cost using an immutable application snapshot", async () => {
        const deps = dependencies();

        const reservation = await reserveSpecializedTaskBilling(
            {
                tenantId: "tenant-one",
                userId: "user-one",
                generationTaskId: "task-one",
                tenantApp: tenantApp(),
                candidate: candidate(),
                quantity: 4,
            },
            deps,
        );

        expect(deps.accounts.wallet.getOrCreateAccount).toHaveBeenCalledWith({
            tenantId: "tenant-one",
            userId: "user-one",
            currency: "POINT",
        });
        expect(deps.accounts.power.getOrCreateAccount).toHaveBeenCalledWith({
            tenantId: "tenant-one",
            unit: "POWER",
        });
        expect(deps.billing.reserve).toHaveBeenCalledWith({
            tenantId: "tenant-one",
            generationTaskId: "task-one",
            userId: "user-one",
            walletAccountId: "wallet-one",
            powerAccountId: "power-one",
            saleAmount: 60,
            costAmount: 26,
            idempotencyKey: "specialized-task-billing:task-one:reserve",
            snapshot: expect.objectContaining({
                tenantId: "tenant-one",
                generationTaskId: "task-one",
                appKey: "image-human",
                appVersion: "1.0.0",
                workflowKey: "image-human.v1",
                collectionMode: "tenant",
                logicalModelKey: "image-human-pro",
                upstreamModel: "avatar-v2",
                salePricing: { currency: "POINT", unit: "second", amount: 15, quantity: 4, total: 60 },
                costPricing: { unit: "POWER", amount: 6.5, quantity: 4, total: 26 },
            }),
        });
        expect(reservation).toMatchObject({ saleAmount: 60, costAmount: 26 });
        expect(JSON.stringify(reservation.snapshot)).not.toContain("secret");
        expect(JSON.stringify(reservation.snapshot)).not.toContain("provider.example.com");
    });

    it("uses application defaults and zero provider cost when no tenant or channel override exists", async () => {
        const deps = dependencies();
        const defaultCandidate = { ...candidate(), capabilityProfile: undefined };

        await reserveSpecializedTaskBilling(
            {
                tenantId: "tenant-one",
                userId: "user-one",
                generationTaskId: "task-two",
                tenantApp: tenantApp({ pricing: null }),
                candidate: defaultCandidate,
                quantity: 3,
            },
            deps,
        );

        expect(deps.accounts.power.getOrCreateAccount).toHaveBeenCalledWith({
            tenantId: "tenant-one",
            unit: "POINT",
        });
        expect(deps.billing.reserve).toHaveBeenCalledWith(
            expect.objectContaining({
                saleAmount: 36,
                costAmount: 0,
            }),
        );
    });

    it("releases a successful reservation with a stable idempotency key", async () => {
        const deps = dependencies();

        await releaseSpecializedTaskBilling(
            {
                tenantId: "tenant-one",
                generationTaskId: "task-one",
            },
            deps,
        );

        expect(deps.billing.release).toHaveBeenCalledWith({
            tenantId: "tenant-one",
            generationTaskId: "task-one",
            idempotencyKey: "specialized-task-billing:task-one:release",
        });
    });
});
