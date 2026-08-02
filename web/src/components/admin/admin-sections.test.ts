import { describe, expect, it } from "vitest";

import { adminSectionHref, parseAdminSection } from "./admin-sections";

describe("admin sections", () => {
    it("parses a valid section and falls back to overview", () => {
        expect(parseAdminSection("channels")).toBe("channels");
        expect(parseAdminSection(["skills", "channels"])).toBe("skills");
        expect(parseAdminSection("missing")).toBe("overview");
    });

    it("keeps unrelated query parameters while updating the current section", () => {
        expect(adminSectionHref("channels", "https://example.com/admin?from=notice#top")).toBe("/admin?from=notice&section=channels#top");
        expect(adminSectionHref("overview", "https://example.com/admin?section=channels&from=notice#top")).toBe("/admin?from=notice#top");
    });
});
