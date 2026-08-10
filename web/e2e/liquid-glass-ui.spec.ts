import { expect, test } from "@playwright/test";

test("workspace exposes the liquid glass shell hooks", async ({ page }) => {
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-glass-shell]")).toBeVisible();
    await expect(page.locator("[data-glass-sidebar]")).toBeVisible();
    await expect(page.locator("[data-glass-header]")).toBeVisible();
    await expect(page.locator("[data-glass-header]")).toHaveCSS("backdrop-filter", /blur/);
});

test("mobile workspace keeps the glass shell within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-glass-shell]")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
