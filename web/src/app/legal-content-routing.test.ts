import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
    return fs.readFileSync(path.join(process.cwd(), "src/app", file, "page.tsx"), "utf8");
}

describe("managed legal content", () => {
    it("renders managed terms markdown when configured", () => {
        const terms = source("terms");
        expect(terms).toContain("getPublicSiteSettings");
        expect(terms).toContain("site.termsContent");
        expect(terms).toContain("LegalMarkdownPage");
    });

    it("renders managed privacy markdown when configured", () => {
        const privacy = source("privacy");
        expect(privacy).toContain("getPublicSiteSettings");
        expect(privacy).toContain("site.privacyContent");
        expect(privacy).toContain("LegalMarkdownPage");
    });
});
