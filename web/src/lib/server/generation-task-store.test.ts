import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    records: [] as Array<Record<string, unknown>>,
    applyBillingOutcome: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
    ensurePostgresSchema: vi.fn(),
    getDatabaseProvider: vi.fn(() => "file"),
    postgresQuery: vi.fn(),
    withPostgresTransaction: vi.fn(),
}));
vi.mock("@/lib/server/data-adapter", () => ({
    readJsonDataFile: vi.fn(async () => structuredClone(mocks.records)),
    withJsonDataFileLock: vi.fn(async (_fileName: string, callback: () => Promise<unknown>) => callback()),
    writeJsonDataFile: vi.fn(async (_fileName: string, value: Array<Record<string, unknown>>) => {
        mocks.records = structuredClone(value);
    }),
}));
vi.mock("@/lib/server/billing/generation-task-billing-hook", () => ({
    applyGenerationTaskBillingOutcome: mocks.applyBillingOutcome,
}));

import { getDatabaseProvider, postgresQuery } from "@/lib/server/database";
import {
    createStoredGenerationTask,
    getStoredGenerationTask,
    getStoredGenerationTaskByRequest,
    getStoredGenerationTaskByUpstream,
    listStoredGenerationTaskRecords,
    mutateStoredGenerationTask,
    summarizeStoredGenerationTaskCosts,
    transitionStoredGenerationTask,
    withGenerationConcurrencyLimit,
} from "./generation-task-store";

type TestTask = {
    id: string;
    userId: string;
    status: string;
    events: string[];
    createdAt: number;
    updatedAt: number;
};

describe("mutateStoredGenerationTask", () => {
    beforeEach(() => {
        mocks.applyBillingOutcome.mockReset();
        mocks.applyBillingOutcome.mockResolvedValue(undefined);
        const now = Date.now();
        mocks.records = [
            {
                id: "agent-one",
                userId: "user",
                type: "agent",
                status: "running",
                payload: { id: "agent-one", userId: "user", status: "running", events: [], createdAt: now, updatedAt: now },
                createdAt: now,
                updatedAt: now,
                expiresAt: now + 60_000,
            },
        ];
    });

    it("serializes file mutations so concurrent events are not lost", async () => {
        await Promise.all([
            mutateStoredGenerationTask<TestTask>("agent", "agent-one", 60_000, (current) => ({ ...current, events: [...current.events, "first"] })),
            mutateStoredGenerationTask<TestTask>("agent", "agent-one", 60_000, (current) => ({ ...current, events: [...current.events, "second"] })),
        ]);

        expect((mocks.records[0].payload as TestTask).events).toEqual(["first", "second"]);
    });

    it("applies app billing only after a terminal transition has been persisted", async () => {
        const task = mocks.records[0].payload as TestTask & { appKey?: string; tenantId?: string };
        task.appKey = "canvas";
        task.tenantId = "default";
        mocks.records[0].payload = task;
        mocks.applyBillingOutcome.mockImplementation(async () => {
            expect((mocks.records[0].payload as TestTask).status).toBe("success");
        });

        await expect(
            transitionStoredGenerationTask<TestTask & { appKey?: string; tenantId?: string }>(
                "agent",
                "agent-one",
                "user",
                ["running"],
                { status: "success" },
                60_000,
            ),
        ).resolves.toMatchObject({ id: "agent-one", status: "success" });

        expect(mocks.applyBillingOutcome).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: "default",
                generationTaskId: "agent-one",
                outcome: "success",
                sourceEventId: expect.any(String),
            }),
        );
    });

    it("does not let terminal billing failures undo the persisted generation outcome", async () => {
        const task = mocks.records[0].payload as TestTask & { appKey?: string; tenantId?: string };
        task.appKey = "canvas";
        task.tenantId = "default";
        mocks.records[0].payload = task;
        mocks.applyBillingOutcome.mockRejectedValueOnce(new Error("billing unavailable"));
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

        try {
            await expect(
                transitionStoredGenerationTask<TestTask & { appKey?: string; tenantId?: string }>(
                    "agent",
                    "agent-one",
                    "user",
                    ["running"],
                    { status: "success" },
                    60_000,
                ),
            ).resolves.toMatchObject({ id: "agent-one", status: "success" });
            expect((mocks.records[0].payload as TestTask).status).toBe("success");
        } finally {
            error.mockRestore();
        }
    });

    it("reconciles a terminal mutation through the same app billing boundary", async () => {
        const task = mocks.records[0].payload as TestTask & { appKey?: string; tenantId?: string };
        task.appKey = "canvas";
        task.tenantId = "default";
        mocks.records[0].payload = task;

        await mutateStoredGenerationTask<TestTask & { appKey?: string; tenantId?: string }>("agent", "agent-one", 60_000, (current) => ({ ...current, status: "cancelled" }));

        expect(mocks.applyBillingOutcome).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: "default",
                generationTaskId: "agent-one",
                outcome: "cancelled",
            }),
        );
    });

    it("serializes concurrency checks with task creation", async () => {
        mocks.records = [];
        const create = (id: string) =>
            withGenerationConcurrencyLimit("user", "video", 60_000, 1, async () => {
                const now = Date.now();
                mocks.records.unshift({ id, userId: "user", type: "video", status: "pending", payload: {}, executionPhase: "created", createdAt: now, updatedAt: now, expiresAt: now + 60_000 });
                return id;
            });

        await expect(Promise.all([create("video-one"), create("video-two")])).resolves.toEqual(["video-one", null]);
        expect(mocks.records).toHaveLength(1);
    });

    it("does not let tasks awaiting manual review consume generation capacity", async () => {
        const now = Date.now();
        mocks.records = [
            {
                id: "image-review",
                userId: "user",
                type: "image",
                status: "running",
                executionPhase: "needs_review",
                payload: {},
                createdAt: now,
                updatedAt: now,
                expiresAt: now + 60_000,
            },
        ];

        await expect(withGenerationConcurrencyLimit("user", "image", 60_000, 1, async () => "image-retry")).resolves.toBe("image-retry");
    });

    it("deduplicates the same request attempt but allows a later retry attempt", async () => {
        mocks.records = [];
        const now = Date.now();
        const first = await createStoredGenerationTask("video", { id: "video-one", userId: "user", status: "pending", clientRequestId: "request-one", attemptNo: 1, createdAt: now, updatedAt: now }, 60_000);
        const duplicate = await createStoredGenerationTask("video", { id: "video-duplicate", userId: "user", status: "pending", clientRequestId: "request-one", attemptNo: 1, createdAt: now, updatedAt: now }, 60_000);
        const retry = await createStoredGenerationTask("video", { id: "video-retry", userId: "user", status: "pending", clientRequestId: "request-one", attemptNo: 2, createdAt: now, updatedAt: now }, 60_000);

        expect(first.id).toBe("video-one");
        expect(duplicate.id).toBe("video-one");
        expect(retry.id).toBe("video-retry");
        expect(mocks.records).toHaveLength(2);
        expect(mocks.records.every((record) => record.executionPhase === "created")).toBe(true);
        await expect(getStoredGenerationTaskByRequest<{ id: string }>("video", "default", "user", "request-one", 1)).resolves.toMatchObject({ id: "video-one" });
        await expect(getStoredGenerationTaskByRequest<{ id: string }>("video", "default", "user", "request-one", 2)).resolves.toMatchObject({ id: "video-retry" });
        await expect(getStoredGenerationTaskByRequest<{ id: string }>("video", "default", "user", "request-one", 3)).resolves.toBeNull();
    });

    it("includes tenant id in request idempotency lookup", async () => {
        vi.mocked(getDatabaseProvider).mockReturnValue("postgres");
        vi.mocked(postgresQuery).mockResolvedValueOnce({ rows: [] } as never);

        try {
            await getStoredGenerationTaskByRequest("image", "tenant-a", "user-one", "req-one", 0);

            expect(vi.mocked(postgresQuery)).toHaveBeenCalledWith(
                expect.stringContaining("tenant_id = $1 AND user_id = $2"),
                ["tenant-a", "user-one", "image", "req-one", 0],
            );
        } finally {
            vi.mocked(postgresQuery).mockClear();
            vi.mocked(getDatabaseProvider).mockReturnValue("file");
        }
    });

    it("finds only the current user's exact channel task identity", async () => {
        const now = Date.now();
        mocks.records = [
            { id: "video-one", userId: "user", type: "video", status: "running", channelId: "channel-one", upstreamTaskId: "upstream-one", payload: { config: { model: "vendor-video" } }, createdAt: now, updatedAt: now, expiresAt: now + 60_000 },
        ];

        await expect(getStoredGenerationTaskByUpstream("video", "default", "user", "channel-one", "upstream-one")).resolves.toMatchObject({ id: "video-one" });
        await expect(getStoredGenerationTaskByUpstream("video", "default", "other", "channel-one", "upstream-one")).resolves.toBeNull();
        await expect(getStoredGenerationTaskByUpstream("video", "default", "user", "channel-two", "upstream-one")).resolves.toBeNull();
    });

    it("uses an entity-scoped PostgreSQL lookup for upstream ownership", async () => {
        vi.mocked(getDatabaseProvider).mockReturnValue("postgres");
        vi.mocked(postgresQuery).mockResolvedValueOnce({ rows: [], command: "SELECT", rowCount: 0, oid: 0, fields: [] });

        await getStoredGenerationTaskByUpstream("audio", "default", "user", "channel-one", "upstream-one");

        expect(vi.mocked(postgresQuery).mock.calls[0][0]).toContain("tenant_id = $1 AND user_id = $2 AND task_type = $3 AND channel_id = $4 AND upstream_task_id = $5");
        expect(vi.mocked(postgresQuery).mock.calls[0][1]).toEqual(["default", "user", "audio", "channel-one", "upstream-one"]);
        vi.mocked(postgresQuery).mockClear();
        vi.mocked(getDatabaseProvider).mockReturnValue("file");
    });
});

describe("listStoredGenerationTaskRecords", () => {
    it("matches file-provider tasks through resolved public user ids", async () => {
        vi.mocked(getDatabaseProvider).mockReturnValue("file");
        const now = Date.now();
        mocks.records = [
            { id: "task-one", userId: "user-one", type: "image", status: "success", payload: { prompt: "first" }, createdAt: now, updatedAt: now, expiresAt: now + 60_000 },
            { id: "task-two", userId: "user-two", type: "image", status: "success", payload: { prompt: "second" }, createdAt: now, updatedAt: now, expiresAt: now + 60_000 },
        ];

        const result = await listStoredGenerationTaskRecords({ tenantId: "default", search: "0001", searchUserIds: ["user-one"], includeAll: false });

        expect(result.items.map((item) => item.id)).toEqual(["task-one"]);
    });

    it("pushes PostgreSQL filters, pagination and aggregate summary into database queries", async () => {
        vi.mocked(getDatabaseProvider).mockReturnValue("postgres");
        vi.mocked(postgresQuery)
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: "task-one",
                        user_id: "user-one",
                        task_type: "video",
                        status: "success",
                        surface: "chat",
                        project_id: "project-one",
                        payload: { prompt: "needle" },
                        created_at: new Date(1),
                        updated_at: new Date(2),
                        expires_at: new Date(Date.now() + 60_000),
                        total_count: "1",
                    },
                ],
            } as never)
            .mockResolvedValueOnce({ rows: [{ task_type: "video", status: "success", total: "1", completed_total: "1", duration_total_ms: "1", points_cost: "3" }] } as never);

        const result = await listStoredGenerationTaskRecords({ tenantId: "default", page: 1, pageSize: 20, type: "video", status: "success", surface: "chat", projectId: "project-one", userId: "user-one", search: "needle", searchUserIds: ["user-one"], includeAll: false });
        const [pageQuery, pageParams] = vi.mocked(postgresQuery).mock.calls[0] || [];
        const [summaryQuery, summaryParams] = vi.mocked(postgresQuery).mock.calls[1] || [];

        expect(String(pageQuery)).toContain("payload::text ILIKE");
        expect(String(pageQuery)).toContain("user_id = ANY($8::text[])");
        expect(String(pageQuery)).toContain("LIMIT $9 OFFSET $10");
        expect(pageParams).toEqual(["default", "video", "success", "chat", "project-one", "user-one", "needle", ["user-one"], 20, 0]);
        expect(String(summaryQuery)).toContain("GROUP BY task_type, status");
        expect(summaryParams).toEqual(["default", "video", "success", "chat", "project-one", "user-one", "needle", ["user-one"]]);
        expect(result).toMatchObject({ total: 1, items: [{ id: "task-one", type: "video" }], all: [], summary: { total: 1, totalPointsCost: 3 } });
    });
});

describe("summarizeStoredGenerationTaskCosts", () => {
    it("aggregates project costs in PostgreSQL without loading task payload rows", async () => {
        vi.mocked(getDatabaseProvider).mockReturnValue("postgres");
        vi.mocked(postgresQuery).mockClear();
        vi.mocked(postgresQuery).mockResolvedValueOnce({
            rows: [
                { task_type: "image", status: "success", task_count: "2", estimated_points: "4", actual_points: "3.5" },
                { task_type: "video", status: "error", task_count: "1", estimated_points: "8", actual_points: "0" },
            ],
        } as never);

        const result = await summarizeStoredGenerationTaskCosts({ tenantId: "default", userId: "user-one", projectId: "project-one", types: ["image", "video", "image"] });
        const [statement, params] = vi.mocked(postgresQuery).mock.calls[0] || [];

        expect(String(statement)).toContain("GROUP BY task_type, status");
        expect(String(statement)).not.toContain("LIMIT 5000");
        expect(String(statement)).toContain("nullif(sum(");
        expect(String(statement)).toContain("attempt->>'status' IN ('succeeded', 'success')");
        expect(params).toEqual(["default", "user-one", "project-one", ["image", "video"]]);
        expect(result).toEqual([
            { type: "image", status: "success", taskCount: 2, estimatedPoints: 4, actualPoints: 3.5 },
            { type: "video", status: "error", taskCount: 1, estimatedPoints: 8, actualPoints: 0 },
        ]);
    });
});
