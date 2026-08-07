import { describe, expect, it } from "vitest";

import { ADMIN_SECTION_KEYS, adminSectionHref, parseAdminSection } from "./admin-sections";
import { adminSectionGroups, adminSections } from "./admin-section-nav";

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

    it("exposes a platform tenant management section", () => {
        expect(ADMIN_SECTION_KEYS).toContain("tenants");
        expect(adminSections.find((section) => section.key === "tenants")?.label).toBe("租户管理");
        expect(adminSectionGroups.find((group) => group.title === "系统管理")?.items.map((item) => item.key)).toContain("tenants");
    });
});
