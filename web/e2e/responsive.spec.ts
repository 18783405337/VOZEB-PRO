import { expect, test } from "@playwright/test";

test("creative workspaces remain usable without horizontal overflow in light and dark themes", async ({ page, request }) => {
    const created = await request.post("/api/drama/projects", { data: { title: "E2E 短剧项目", ratio: "9:16" } });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: { id: string } } }).data.project;
    const routes = ["/create", "/image", "/video", "/canvas", `/drama/${project.id}`];

    for (const route of routes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
        if (route.startsWith("/drama/")) {
            await expect(page.locator("main header input").first()).toHaveValue("E2E 短剧项目");
            await page.getByRole("button", { name: "02 内容审核" }).click();
            await expect(page.getByRole("heading", { name: "内容审核" })).toBeVisible();
        }
        await expectNoHorizontalOverflow(page, route);
    }

    await page.addInitScript(() => {
        localStorage.setItem("vozeb-pro:theme_store", JSON.stringify({ state: { theme: "dark" }, version: 0 }));
    });
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectNoHorizontalOverflow(page, "/create dark");
});

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
    await expect
        .poll(async () =>
            page.evaluate(() => ({
                viewport: window.innerWidth,
                documentClientWidth: document.documentElement.clientWidth,
                documentScrollWidth: document.documentElement.scrollWidth,
                bodyClientWidth: document.body.clientWidth,
                bodyScrollWidth: document.body.scrollWidth,
            })),
        )
        .toMatchObject({
            documentScrollWidth: expect.any(Number),
            bodyScrollWidth: expect.any(Number),
        });
    const sizes = await page.evaluate(() => ({ document: [document.documentElement.clientWidth, document.documentElement.scrollWidth], body: [document.body.clientWidth, document.body.scrollWidth] }));
    expect(sizes.document[1], `${label} document overflow`).toBeLessThanOrEqual(sizes.document[0] + 1);
    expect(sizes.body[1], `${label} body overflow`).toBeLessThanOrEqual(sizes.body[0] + 1);
    const controls = await page.locator("main, [role='main'], button, [role='button'], input, textarea, .ant-card").evaluateAll((nodes) =>
        nodes
            .map((node) => {
                const element = node as HTMLElement;
                const bounds = element.getBoundingClientRect();
                return { visible: bounds.width > 0 && bounds.height > 0, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
            })
            .filter((item) => item.visible),
    );
    for (const control of controls) expect(control.scrollWidth, `${label} control overflow`).toBeLessThanOrEqual(control.clientWidth + 1);
}
