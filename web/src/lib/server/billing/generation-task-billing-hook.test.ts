import { describe, expect, it, vi } from "vitest";

import {
    applyGenerationTaskBillingOutcome,
    reverseGenerationTaskBilling,
    type GenerationTaskBillingHookDependencies,
} from "./generation-task-billing-hook";

function setup(status: "reserved" | "settled" = "reserved"): GenerationTaskBillingHookDependencies {
    const reservation = {
        id: "reservation-one",
        tenantId: "tenant-one",
        generationTaskId: "task-one",
        userWalletId: "wallet-one",
        powerAccountId: "power-one",
        saleReserved: 100,
        costReserved: 40,
        saleSettled: status === "settled" ? 80 : 0,
        costSettled: status === "settled" ? 30 : 0,
        status,
        idempotencyKey: "reserve-task-one",
        snapshot: { tenantId: "tenant-one", generationTaskId: "task-one", saleAmount: 100, costAmount: 40 },
        createdAt: 1,
        updatedAt: 1,
    } as const;
    return {
        reservations: {
            getByTask: vi.fn(async () => reservation),
        },
        billing: {
            settle: vi.fn(async () => reservation),
            release: vi.fn(async () => ({ ...reservation, status: "released" as const })),
            reverse: vi.fn(async () => ({ ...reservation, status: "reversed" as const })),
        },
        recordOutcome: vi.fn(async () => undefined),
    };
}

describe("generation task billing hook", () => {
    it("settles the stored reservation with actual billable usage", async () => {
        const dependencies = setup();

        await applyGenerationTaskBillingOutcome(
            {
                tenantId: "tenant-one",
                generationTaskId: "task-one",
                outcome: "success",
                billableUsage: { saleAmount: 80, costAmount: 30 },
                sourceEventId: "poller:task-one:success",
            },
            dependencies,
        );

        expect(dependencies.billing.settle).toHaveBeenCalledWith({
            tenantId: "tenant-one",
            generationTaskId: "task-one",
            actualSaleAmount: 80,
            actualCostAmount: 30,
            idempotencyKey: "generation-task-billing:task-one:success:poller:task-one:success",
        });
        expect(dependencies.recordOutcome).toHaveBeenCalledWith(
            expect.objectContaining({ status: "settled", outcome: "success" }),
        );
    });

    it.each(["error", "cancelled"] as const)("releases the reservation for a %s terminal outcome", async (outcome) => {
        const dependencies = setup();

        await applyGenerationTaskBillingOutcome(
            { tenantId: "tenant-one", generationTaskId: "task-one", outcome, sourceEventId: `${outcome}:task-one` },
            dependencies,
        );

        expect(dependencies.billing.release).toHaveBeenCalledWith({
            tenantId: "tenant-one",
            generationTaskId: "task-one",
            idempotencyKey: `generation-task-billing:task-one:${outcome}:${outcome}:task-one`,
        });
    });

    it("does not fail historical tasks without a billing reservation", async () => {
        const dependencies = setup();
        vi.mocked(dependencies.reservations.getByTask).mockResolvedValueOnce(null);

        await expect(
            applyGenerationTaskBillingOutcome({
                tenantId: "tenant-one",
                generationTaskId: "legacy-task",
                outcome: "success",
                sourceEventId: "legacy-success",
            }, dependencies),
        ).resolves.toBeUndefined();
        expect(dependencies.billing.settle).not.toHaveBeenCalled();
        expect(dependencies.recordOutcome).toHaveBeenCalledWith(
            expect.objectContaining({ status: "not_applicable", outcome: "success" }),
        );
    });

    it("reverses a settled reservation through the same task boundary", async () => {
        const dependencies = setup("settled");

        await reverseGenerationTaskBilling(
            { tenantId: "tenant-one", generationTaskId: "task-one", sourceEventId: "admin:refund:one" },
            dependencies,
        );

        expect(dependencies.billing.reverse).toHaveBeenCalledWith({
            tenantId: "tenant-one",
            generationTaskId: "task-one",
            idempotencyKey: "generation-task-billing:task-one:reverse:admin:refund:one",
        });
    });

    it("records a retryable error state when settlement fails", async () => {
        const dependencies = setup();
        vi.mocked(dependencies.billing.settle).mockRejectedValueOnce(new Error("ledger unavailable"));

        await expect(
            applyGenerationTaskBillingOutcome(
                {
                    tenantId: "tenant-one",
                    generationTaskId: "task-one",
                    outcome: "success",
                    sourceEventId: "poller:task-one:retry",
                },
                dependencies,
            ),
        ).rejects.toThrow("ledger unavailable");

        expect(dependencies.recordOutcome).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "error",
                outcome: "success",
                error: "ledger unavailable",
            }),
        );
    });
});
