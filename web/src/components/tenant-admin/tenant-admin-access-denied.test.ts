import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tenant admin access denied", () => {
    it("explains the active account and provides account switching", async () => {
        const source = await readFile(resolve(process.cwd(), "src/components/tenant-admin/tenant-admin-access-denied.tsx"), "utf8");

        expect(source).toContain("当前登录账号不属于此租户");
        expect(source).toContain("退出并切换账号");
        expect(source).toContain('/api/auth/logout');
    });
});