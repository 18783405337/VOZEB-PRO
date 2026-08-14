import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
    return fs.readFileSync(path.join(process.cwd(), "src/components/layout", file), "utf8");
}

describe("legal navigation", () => {
    it("shows a desktop parent menu with admin-configured legal links", () => {
        const desktop = source("app-sidebar.tsx");
        expect(desktop).toContain("协议与政策");
        expect(desktop).toContain("服务条款");
        expect(desktop).toContain("隐私协议");
        expect(desktop).toContain('site.termsUrl || "/terms"');
        expect(desktop).toContain('site.privacyUrl || "/privacy"');
        expect(desktop).toContain("onRequestExpand");
    });

    it("shows the same legal submenu in the mobile drawer", () => {
        const mobile = source("mobile-nav-drawer.tsx");
        expect(mobile).toContain("协议与政策");
        expect(mobile).toContain("服务条款");
        expect(mobile).toContain("隐私协议");
        expect(mobile).toContain('site.termsUrl || "/terms"');
        expect(mobile).toContain('site.privacyUrl || "/privacy"');
    });
});
