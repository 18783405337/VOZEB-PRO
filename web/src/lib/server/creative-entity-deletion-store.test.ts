import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    files: new Map<string, unknown>(),
    provider: "file" as "file" | "postgres",
    writeFailure: "",
    transaction: vi.fn(),
}));

vi.mock("@/lib/server/database", () => ({
    ensurePostgresSchema: vi.fn(),
    getDatabaseProvider: vi.fn(() => mocks.provider),
    withPostgresTransaction: mocks.transaction,
}));

vi.mock("@/lib/server/data-adapter", () => ({
    readJsonDataFile: vi.fn(async (name: string, fallback: unknown) => structuredClone(mocks.files.has(name) ? mocks.files.get(name) : fallback)),
    writeJsonDataFile: vi.fn(async (name: string, value: unknown) => {
        if (mocks.writeFailure === name) {
            mocks.writeFailure = "";
            throw new Error("write failed");
        }
        mocks.files.set(name, structuredClone(value));
    }),
    withJsonDataFileLocks: vi.fn(async (_names: string[], callback: () => Promise<unknown>) => callback()),
}));

import { deleteCanvasProjectAggregates, deleteCreativeConversationAggregates } from "./creative-entity-deletion-store";

describe("creative entity deletion file provider", () => {
    beforeEach(() => {
        mocks.provider = "file";
        mocks.writeFailure = "";
        mocks.files.clear();
        seedFiles();
        mocks.transaction.mockReset();
    });

    it("hard-deletes one conversation and all of its owned records", async () => {
        const result = await deleteCreativeConversationAggregates("user-one", ["conversation-one"]);

        expect(result).toMatchObject({ deletedConversations: 1, deletedProjects: 0 });
        expect(result.mediaStorageKeys).toEqual(expect.arrayContaining(["permanent/shared.png", "permanent/only-one.png"]));
        expect(file<{ conversations: Array<{ id: string }> }>("creative-runtime.json").conversations.map((item) => item.id)).toEqual(["conversation-two"]);
        expect(file<{ messages: Array<{ conversationId: string }> }>("creative-runtime.json").messages).toEqual([{ id: "message-two", conversationId: "conversation-two" }]);
        expect(file<{ assets: Array<{ conversationId: string }> }>("creative-runtime.json").assets).toHaveLength(1);
        expect(file<{ events: Array<{ runId: string }> }>("creative-runtime.json").events).toEqual([{ id: "2", runId: "run-two" }]);
        expect(file<Array<{ id: string }>>("generation-tasks.json").map((item) => item.id)).toEqual(["run-two"]);
        expect(file<{ logs: Array<{ id: string }> }>("generation-logs.json").logs.map((item) => item.id)).toEqual(["log-two"]);
    });

    it("deletes a Canvas project together with its linked conversation and tasks", async () => {
        const runtime = file<{ conversations: Array<Record<string, unknown>> }>("creative-runtime.json");
        runtime.conversations[0] = { ...runtime.conversations[0], surface: "canvas", projectId: "canvas-one" };
        const result = await deleteCanvasProjectAggregates("user-one", ["canvas-one"]);

        expect(result).toMatchObject({ deletedConversations: 1, deletedProjects: 1 });
        expect(result.mediaStorageKeys).toEqual(expect.arrayContaining(["permanent/canvas-only.png", "permanent/only-one.png"]));
        expect(file<{ projects: Array<{ project: { id: string } }> }>("canvas-projects.json").projects.map((item) => item.project.id)).toEqual(["canvas-two"]);
        expect(file<{ conversations: Array<{ id: string }> }>("creative-runtime.json").conversations.map((item) => item.id)).toEqual(["conversation-two"]);
        expect(file<Array<{ id: string }>>("generation-tasks.json").map((item) => item.id)).toEqual(["run-two"]);
    });

    it("uses one PostgreSQL transaction with owner-scoped entity deletes", async () => {
        mocks.provider = "postgres";
        const query = vi.fn(async (sql: string) => {
            if (sql.includes("FROM canvas_projects") && sql.includes("SELECT")) return { rows: [] };
            if (sql.includes("FROM creative_conversations") && sql.includes("SELECT")) return { rows: [{ id: "conversation-one" }] };
            if (sql.includes("FROM creative_messages")) return { rows: [{ run_id: "run-one" }] };
            if (sql.includes("FROM generation_tasks") && sql.includes("parent_task_id = ANY")) return { rows: [] };
            if (sql.includes("FROM generation_tasks") && sql.includes("SELECT")) return { rows: [{ id: "run-one", run_id: "run-one", payload: { serverUrl: "/api/generation-log-assets/permanent/task.png" } }] };
            if (sql.includes("FROM generation_logs") && sql.includes("SELECT")) return { rows: [{ id: "log-one", request_snapshot: {} }] };
            if (sql.includes("FROM creative_assets")) return { rows: [{ storage_key: "permanent/asset.png" }] };
            if (sql.includes("FROM generation_log_assets")) return { rows: [{ server_url: "/api/generation-log-assets/permanent/log.png" }] };
            if (sql.includes("FROM local_media_assets")) return { rows: [{ storage_key: "permanent/registered.png" }] };
            return { rows: [], rowCount: 1 };
        });
        mocks.transaction.mockImplementation(async (callback: (client: { query: typeof query }) => Promise<unknown>) => callback({ query }));

        const result = await deleteCreativeConversationAggregates("user-one", ["conversation-one"]);

        expect(result).toMatchObject({ deletedConversations: 1, deletedProjects: 0 });
        expect(result.mediaStorageKeys).toEqual(["permanent/asset.png", "permanent/log.png", "permanent/registered.png", "permanent/task.png"]);
        const statements = query.mock.calls.map(([sql]) => String(sql)).join("\n");
        for (const table of ["creative_run_events", "generation_logs", "generation_tasks", "creative_conversations"]) expect(statements).toContain(`DELETE FROM ${table}`);
        expect(statements).not.toContain("SELECT *");
    });

    it("rolls back every file when one aggregate write fails", async () => {
        const before = structuredClone(Object.fromEntries(mocks.files));
        mocks.writeFailure = "generation-logs.json";

        await expect(deleteCreativeConversationAggregates("user-one", ["conversation-one"])).rejects.toThrow("write failed");

        expect(Object.fromEntries(mocks.files)).toEqual(before);
    });
});

function seedFiles() {
    const now = Date.now();
    mocks.files.set("creative-runtime.json", {
        version: 1,
        nextEventId: 3,
        conversations: [
            { id: "conversation-one", userId: "user-one", surface: "chat", source: "agent", title: "一", status: "active", contextSummary: "", contextSummaryThroughSequence: 0, createdAt: now, updatedAt: now, lastMessageAt: now },
            { id: "conversation-two", userId: "user-one", surface: "chat", source: "agent", title: "二", status: "active", contextSummary: "", contextSummaryThroughSequence: 0, createdAt: now, updatedAt: now, lastMessageAt: now },
        ],
        messages: [
            { id: "message-one", conversationId: "conversation-one" },
            { id: "message-two", conversationId: "conversation-two" },
        ],
        assets: [
            { id: "asset-one", userId: "user-one", conversationId: "conversation-one", storageKey: "permanent/only-one.png", serverUrl: "/api/reference-assets/permanent/only-one.png" },
            { id: "asset-two", userId: "user-one", conversationId: "conversation-two", storageKey: "permanent/shared.png", serverUrl: "/api/reference-assets/permanent/shared.png" },
        ],
        events: [
            { id: "1", runId: "run-one" },
            { id: "2", runId: "run-two" },
        ],
    });
    mocks.files.set("generation-tasks.json", [
        {
            id: "run-one",
            userId: "user-one",
            type: "agent",
            conversationId: "conversation-one",
            projectId: "canvas-one",
            payload: { result: "/api/generation-log-assets/permanent/shared.png" },
            resultPayload: {},
            createdAt: now,
            updatedAt: now,
            expiresAt: now + 1_000,
        },
        { id: "run-two", userId: "user-one", type: "agent", conversationId: "conversation-two", projectId: "canvas-two", payload: {}, resultPayload: {}, createdAt: now, updatedAt: now, expiresAt: now + 1_000 },
    ]);
    mocks.files.set("generation-logs.json", {
        version: 1,
        logs: [
            { id: "log-one", userId: "user-one", conversationId: "conversation-one", taskId: "run-one", assets: [{ serverUrl: "/api/generation-log-assets/permanent/shared.png" }] },
            { id: "log-two", userId: "user-one", conversationId: "conversation-two", taskId: "run-two", assets: [{ serverUrl: "/api/generation-log-assets/permanent/shared.png" }] },
        ],
    });
    mocks.files.set("canvas-projects.json", {
        version: 1,
        projects: [
            { userId: "user-one", project: { id: "canvas-one", creativeConversationId: "conversation-one", nodes: [{ metadata: { serverUrl: "/api/reference-assets/permanent/canvas-only.png" } }] } },
            { userId: "user-one", project: { id: "canvas-two", creativeConversationId: "conversation-two", nodes: [] } },
        ],
    });
    mocks.files.set("local-media-assets.json", {
        version: 1,
        assets: [{ ownerUserId: "user-one", storageKey: "permanent/registered.png", conversationId: "conversation-one", taskId: "run-one" }],
    });
}

function file<T>(name: string) {
    return mocks.files.get(name) as T;
}
