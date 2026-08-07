import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tenant admin shell", () => {
    it("keeps member and role administration separate from platform settings", async () => {
        const source = await readFile(resolve(process.cwd(), "src/components/tenant-admin/tenant-admin-shell.tsx"), "utf8");

        expect(source).toContain("成员");
        expect(source).toContain("角色");
        expect(source).toContain("listTenantMembers");
        expect(source).toContain("listTenantRoles");
        expect(source).not.toContain("系统渠道");
    });
});
