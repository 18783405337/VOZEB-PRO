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

    it("loads a provider binding through the tenant application boundary", async () => {
        const query = vi.fn().mockResolvedValue(
            queryResult([
                {
                    id: "binding-one",
                    tenant_app_id: "tenant-app-one",
                    logical_model_key: "digital-human",
                    status: "enabled",
                    bound_by: "user-a",
                    created_at: 100,
                    updated_at: 200,
                },
            ]),
        );
        const repository = new AppCenterPostgresRepository({ query } as unknown as QueryExecutor);

        await expect(repository.getProviderBinding("tenant-a", "aigc-digital-human")).resolves.toEqual({
            id: "binding-one",
            tenantAppId: "tenant-app-one",
            logicalModelKey: "digital-human",
            status: "enabled",
            boundBy: "user-a",
            createdAt: 100,
            updatedAt: 200,
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("JOIN tenant_apps ta"), ["tenant-a", "aigc-digital-human"]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE ta.tenant_id = $1 AND a.app_key = $2"), ["tenant-a", "aigc-digital-human"]);
    });

    it("replaces the single provider binding for an installed tenant application", async () => {
        const query = vi.fn().mockResolvedValue(
            queryResult([
                {
                    id: "binding-one",
                    tenant_app_id: "tenant-app-one",
                    logical_model_key: "image-human",
                    status: "enabled",
                    bound_by: "user-a",
                    created_at: 100,
                    updated_at: 300,
                },
            ]),
        );
        const repository = new AppCenterPostgresRepository({ query } as unknown as QueryExecutor);

        await expect(
            repository.saveProviderBinding("tenant-a", "aigc-digital-human", {
                logicalModelKey: "image-human",
                status: "enabled",
                boundBy: "user-a",
                updatedAt: 300,
            }),
        ).resolves.toEqual({
            id: "binding-one",
            tenantAppId: "tenant-app-one",
            logicalModelKey: "image-human",
            status: "enabled",
            boundBy: "user-a",
            createdAt: 100,
            updatedAt: 300,
        });

        expect(query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT (tenant_app_id) DO UPDATE"), [
            "tenant-a",
            "aigc-digital-human",
            expect.any(String),
            "image-human",
            "enabled",
            "user-a",
            300,
        ]);
    });

    it("clears only the requested tenant application binding", async () => {
        const query = vi.fn().mockResolvedValue(queryResult([{ tenant_app_id: "tenant-app-one" }]));
        const repository = new AppCenterPostgresRepository({ query } as unknown as QueryExecutor);

        await expect(repository.clearProviderBinding("tenant-a", "aigc-digital-human")).resolves.toBeUndefined();

        expect(query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM tenant_app_provider_bindings"), ["tenant-a", "aigc-digital-human"]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("AND ta.tenant_id = $1"), ["tenant-a", "aigc-digital-human"]);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("AND a.app_key = $2"), ["tenant-a", "aigc-digital-human"]);
    });

    it("exports the application repository from the shared factory", () => {
        const query = vi.fn().mockResolvedValue(queryResult());

        expect(createPostgresRepositories({ query } as unknown as QueryExecutor).appCenter).toBeInstanceOf(AppCenterPostgresRepository);
    });
});
