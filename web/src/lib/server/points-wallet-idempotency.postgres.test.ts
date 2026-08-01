import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createPostgresRepositories, ensurePostgresSchema } from "@/lib/server/database";

import { consumePoints } from "./points-wallet-service";

const postgresIt = process.env.VOZEB_PRO_RUN_POSTGRES_INTEGRATION === "1" ? it : it.skip;

describe("PostgreSQL points wallet idempotency", () => {
    postgresIt("persists the server request fingerprint and rejects conflicting replays", async () => {
        await ensurePostgresSchema();
        const repositories = createPostgresRepositories();
        const settings = await repositories.settings.getSettings();
        const planId = settings.settings?.defaultPlanId || settings.plans[0]?.id;
        if (!planId) throw new Error("No entitlement plan is available for the PostgreSQL integration test");

        const suffix = randomUUID();
        const userId = `test-points-idempotency-${suffix}`;
        const idempotencyKey = `system-ai:test-${suffix}`;
        const requestFingerprint = "a".repeat(64);
        const now = new Date();
        try {
            await repositories.users.createWithNextAccountId({
                id: userId,
                username: `points_${suffix.replaceAll("-", "").slice(0, 16)}`,
                displayName: "积分幂等测试用户",
                bio: "",
                role: "user",
                status: "active",
                planId,
                pointsBalance: 100,
                passwordHash: "integration-test-only",
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
            });

            const input = {
                userId,
                amount: 5,
                units: 1,
                usageKind: "text" as const,
                model: "writer",
                description: "文本模型调用扣除",
                idempotencyKey,
                requestFingerprint,
                now,
            };
            const first = await consumePoints(input);
            const replay = await consumePoints(input);

            await expect(consumePoints({ ...input, requestFingerprint: "b".repeat(64) })).rejects.toThrow("消费参数不一致");
            expect(first.applied).toBe(true);
            expect(replay.applied).toBe(false);
            expect(replay.record.id).toBe(first.record.id);
            expect(await repositories.points.getRecordByIdempotencyKey(idempotencyKey)).toMatchObject({ userId, requestFingerprint, amount: -5 });
        } finally {
            await repositories.users.delete(userId);
        }
    });
});
