import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "./store-foundation";
import { normalizeSiteSettings } from "./store-normalizers";

describe("site settings", () => {
    it("uses the bundled browser icon when older settings have no icon URL", () => {
        expect(normalizeSiteSettings({ logoUrl: "/custom-logo.svg" }).iconUrl).toBe(DEFAULT_SITE_SETTINGS.iconUrl);
    });

    it("accepts a configured browser icon independently from the logo", () => {
        const settings = normalizeSiteSettings({ logoUrl: "/brand.svg", iconUrl: "https://cdn.example.com/favicon.ico" });

        expect(settings.logoUrl).toBe("/brand.svg");
        expect(settings.iconUrl).toBe("https://cdn.example.com/favicon.ico");
    });

    it("defaults public contacts to the VOZEB email and QQ group", () => {
        const settings = normalizeSiteSettings({});

        expect(settings.socials.email).toMatchObject({ enabled: true, url: "mailto:csyqlz@gmail.com" });
        expect(settings.socials.telegram).toMatchObject({ enabled: false, url: "" });
        expect(settings.socials.x).toMatchObject({ enabled: false, url: "" });
        expect(settings.socials.instagram).toMatchObject({ enabled: false, url: "" });
        expect(settings.friendLinks).toContainEqual(expect.objectContaining({ id: "qq-vozeb-open-source", url: "https://qm.qq.com/q/9MVLTxuRd6", enabled: true }));
    });

    it("preserves customized footer links and social contacts", () => {
        const settings = normalizeSiteSettings({
            footerCopyright: "© Monster Studio. All rights reserved.",
            termsUrl: "/custom-terms",
            privacyUrl: "https://example.com/privacy",
            socials: {
                email: { enabled: true, label: "QQ", url: "mailto:owner@example.com" },
                telegram: { enabled: true, label: "Telegram 社群", url: "https://t.me/example" },
                x: { enabled: false, label: "X", url: "https://x.com/example" },
                instagram: { enabled: true, label: "Instagram", url: "https://instagram.com/example" },
            },
        });

        expect(settings).toMatchObject({
            footerCopyright: "© Monster Studio. All rights reserved.",
            termsUrl: "/custom-terms",
            privacyUrl: "https://example.com/privacy",
            socials: {
                email: { enabled: true, label: "QQ", url: "mailto:owner@example.com" },
                telegram: { enabled: true, label: "Telegram 社群", url: "https://t.me/example" },
                x: { enabled: false, label: "X", url: "https://x.com/example" },
                instagram: { enabled: true, label: "Instagram", url: "https://instagram.com/example" },
            },
        });
    });

    it("preserves bounded markdown content for legal documents", () => {
        const settings = normalizeSiteSettings({
            termsContent: "# 服务条款\n\n**请遵守规则。**",
            privacyContent: "# 隐私协议\n\n- 仅收集必要数据",
        });

        expect(settings.termsContent).toContain("**请遵守规则。**");
        expect(settings.privacyContent).toContain("- 仅收集必要数据");
    });
});
