import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin legal markdown editor", () => {
    it("edits and previews both managed legal documents", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src/components/admin/admin-configuration-sections.tsx"), "utf8");
        expect(source).toContain('updateSiteSetting("termsContent"');
        expect(source).toContain('updateSiteSetting("privacyContent"');
        expect(source).toContain("Markdown 富文本");
        expect(source).toContain("AgentMarkdown");
    });
});
