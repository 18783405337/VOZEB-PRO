import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tenant admin page", () => {
    it("guards the page with authentication and trusted tenant membership", async () => {
        const source = await readFile(resolve(process.cwd(), "src/app/tenant-admin/page.tsx"), "utf8");

        expect(source).toContain("getCurrentUser");
        expect(source).toContain("getTenantPageContext");
        expect(source).toContain("/login?next=/tenant-admin");
        expect(source).toContain('redirect("/")');
    });
});
