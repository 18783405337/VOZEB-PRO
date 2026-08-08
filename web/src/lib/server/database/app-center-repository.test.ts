import { describe, expect, it, vi } from "vitest";

import type { QueryExecutor } from "./postgres";
import { AppCenterPostgresRepository } from "./app-center-repository";
import { createPostgresRepositories } from "./repositories";

function queryResult(rows: Record<string, unknown>[] = []) {
    return { rows, rowCount: rows.length };
}

describe("AppCenterPostgresRepository", () => {
    it("cannot load a tenant installation outside the requested tenant", async () => {
        const query = vi.fn().mockResolvedValue(queryResult());
        const repository = new AppCenterPostgresRepository({ query } as unknown as QueryExecutor);

        await expect(repository.getTenantApp("tenant-a", "background-removal")).resolves.toBeNull();

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("WHERE ta.tenant_id = $1 AND a.app_key = $2"),
            ["tenant-a", "background-removal"],
        );
    });

    it("exports the application repository from the shared factory", () => {
        const query = vi.fn().mockResolvedValue(queryResult());

        expect(createPostgresRepositories({ query } as unknown as QueryExecutor).appCenter).toBeInstanceOf(AppCenterPostgresRepository);
    });
});
