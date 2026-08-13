import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("platform tenant admin section", () => {
    it("uses platform tenant APIs and keeps membership management out of the platform section", async () => {
        const source = await readFile(resolve(process.cwd(), "src/components/admin/admin-tenants-section.tsx"), "utf8");

        expect(source).toContain("listPlatformTenants");
        expect(source).toContain("createPlatformTenant");
        expect(source).toContain("updatePlatformTenant");
        expect(source).toContain("DNSPod 主机记录");
        expect(source).toContain("dnsHostRecord(domain.hostname)");
        expect(source).toContain("完整 TXT 记录名");
        expect(source).not.toContain("/api/tenant/members");
        expect(source).not.toContain("/api/tenant/roles");
    });
});
