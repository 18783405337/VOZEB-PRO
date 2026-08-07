import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "./postgres";
import { createPostgresRepositories } from "./repositories";

function mockExecutor() {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    return { executor: { query } as unknown as QueryExecutor, query };
}

function queryArgs(query: ReturnType<typeof mockExecutor>["query"], index: number) {
    return (query.mock.calls as unknown[][])[index] || [];
}

describe("generation log tenant scoping", () => {
    it("scopes id lookups by tenant", async () => {
        const { executor, query } = mockExecutor();

        await createPostgresRepositories(executor).generationLogs.getByIds(["log-one"], "user-one", false, "tenant-one");

        const [statement, params] = queryArgs(query, 0);
        expect(String(statement)).toContain("tenant_id = $3");
        expect(params).toEqual([["log-one"], "user-one", "tenant-one"]);
    });

    it("scopes user listings by tenant", async () => {
        const { executor, query } = mockExecutor();

        await createPostgresRepositories(executor).generationLogs.listByUserId("user-one", false, "tenant-one");

        const [statement, params] = queryArgs(query, 0);
        expect(String(statement)).toContain("user_id = $1");
        expect(String(statement)).toContain("tenant_id = $2");
        expect(params).toEqual(["user-one", "tenant-one"]);
    });

    it("scopes asset URL lookups by tenant", async () => {
        const { executor, query } = mockExecutor();

        await createPostgresRepositories(executor).generationLogs.listByUserAndAssetUrls("user-one", ["/api/generation-log-assets/one.png"], "tenant-one");

        const [statement, params] = queryArgs(query, 0);
        expect(String(statement)).toContain("gl.tenant_id = $3");
        expect(params).toEqual(["user-one", ["/api/generation-log-assets/one.png"], "tenant-one"]);
    });
});
