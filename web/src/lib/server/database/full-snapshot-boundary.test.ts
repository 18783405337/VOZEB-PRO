import { afterEach, describe, expect, it } from "vitest";

import { readAuthDb } from "@/lib/auth/store-repository";
import { readPromptBackup } from "@/lib/prompts/store";
import { readGenerationLogDb } from "@/lib/server/generation-log-repository";
import { DISASTER_REQUIRED_TABLES } from "../../../../scripts/disaster-recovery-core.mjs";

const originalProvider = process.env.VOZEB_PRO_DATABASE_PROVIDER;

afterEach(() => {
    if (originalProvider === undefined) delete process.env.VOZEB_PRO_DATABASE_PROVIDER;
    else process.env.VOZEB_PRO_DATABASE_PROVIDER = originalProvider;
});

describe("PostgreSQL full snapshot boundaries", () => {
    it("requires tenant kernel tables in disaster recovery manifests", () => {
        expect(DISASTER_REQUIRED_TABLES).toEqual(
            expect.arrayContaining(["tenants", "tenant_domains", "tenant_roles", "tenant_role_permissions", "tenant_members"]),
        );
    });

    it("rejects ordinary full-snapshot readers", async () => {
        process.env.VOZEB_PRO_DATABASE_PROVIDER = "postgres";

        await expect(readAuthDb()).rejects.toThrow("entity repositories");
        await expect(readPromptBackup()).rejects.toThrow("scoped repositories");
        await expect(readGenerationLogDb()).rejects.toThrow("scoped repositories");
    });
});
