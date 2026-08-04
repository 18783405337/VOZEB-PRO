import { randomUUID } from "node:crypto";

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

test("conversation and Canvas deletion stay deleted after refresh", async ({ page, request }) => {
    const suffix = randomUUID().slice(0, 8);
    const conversationTitles = [`删除回归 A ${suffix}`, `删除回归 B ${suffix}`, `删除回归 C ${suffix}`];
    const conversations = await Promise.all(
        conversationTitles.map(async (title) => {
            const response = await request.post("/api/creative/conversations", { data: { surface: "chat", source: "agent", title } });
            expect(response.ok(), await response.text()).toBe(true);
            return ((await response.json()) as { data: { conversation: { id: string } } }).data.conversation;
        }),
    );

    await page.goto(`/create?conversationId=${encodeURIComponent(conversations[0].id)}`, { waitUntil: "domcontentloaded" });
    let historyDialog = await openCreativeHistory(page);
    await expect(historyDialog.getByText(conversationTitles[0], { exact: true })).toBeVisible();
    await historyDialog.getByText(conversationTitles[0], { exact: true }).hover();
    await historyDialog.getByRole("button", { name: `管理${conversationTitles[0]}` }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    const conversationDialog = page.getByRole("dialog", { name: "删除这条对话？" });
    await expect(conversationDialog).toContainText("永久删除消息、生成记录");
    await expectDialogWithinViewport(conversationDialog);
    await conversationDialog.getByRole("button", { name: /删\s*除/ }).click();
    await expect(historyDialog.getByText(conversationTitles[0], { exact: true })).toBeHidden();
    expect((await request.get(`/api/creative/conversations/${conversations[0].id}`)).status()).toBe(404);

    await historyDialog.getByRole("button", { name: "批量管理" }).click();
    await historyDialog.getByRole("checkbox", { name: `选择${conversationTitles[1]}` }).check();
    await historyDialog.getByRole("checkbox", { name: `选择${conversationTitles[2]}` }).check();
    await historyDialog.getByRole("button", { name: "批量删除" }).click();
    const batchDialog = page.getByRole("dialog", { name: "删除 2 条对话？" });
    await expectDialogWithinViewport(batchDialog);
    await batchDialog.getByRole("button", { name: /删\s*除/ }).click();
    await expect(batchDialog).toBeHidden();
    await expect(historyDialog.getByText(conversationTitles[1], { exact: true })).toBeHidden();
    await expect(historyDialog.getByText(conversationTitles[2], { exact: true })).toBeHidden();
    await page.reload({ waitUntil: "domcontentloaded" });
    historyDialog = await openCreativeHistory(page);
    for (const title of conversationTitles) await expect(historyDialog.getByText(title, { exact: true })).toHaveCount(0);

    const canvasTitle = `删除画布回归 ${suffix}`;
    const canvasResponse = await request.post("/api/canvas/projects", { data: { title: canvasTitle, project: { nodes: [], connections: [] } } });
    expect(canvasResponse.ok(), await canvasResponse.text()).toBe(true);
    const canvasProject = ((await canvasResponse.json()) as { data: { project: { id: string; creativeConversationId: string } } }).data.project;
    await page.goto("/canvas", { waitUntil: "domcontentloaded" });
    const canvasCard = page.locator("article").filter({ hasText: canvasTitle });
    await expect(canvasCard).toBeVisible();
    await canvasCard.getByLabel("删除", { exact: true }).click();
    const canvasDialog = page.getByRole("dialog", { name: "删除画布？" });
    await expect(canvasDialog).toContainText("永久删除 1 个画布");
    await expectDialogWithinViewport(canvasDialog);
    await canvasDialog.getByRole("button", { name: /删\s*除/ }).click();
    await expect(canvasCard).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(canvasTitle, { exact: true })).toHaveCount(0);
    expect((await request.get(`/api/canvas/projects/${canvasProject.id}`)).status()).toBe(404);
    expect((await request.get(`/api/creative/conversations/${canvasProject.creativeConversationId}`)).status()).toBe(404);
});

test("eight billing plans remain dense and usable across desktop and mobile", async ({ page }, testInfo) => {
    await page.route("**/api/billing/products", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ products: billingProductsFixture(), paymentProviders: ["payply"] }),
        }),
    );
    await page.goto("/profile?section=billing", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "可选套餐" })).toBeVisible();
    await expect.poll(() => page.locator("[role='tab']").count()).toBe(8);

    const layout = await page.evaluate(() => {
        const visible = (element: Element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0;
        };
        const cards = [...document.querySelectorAll<HTMLElement>("[data-billing-plan-card]")].filter(visible);
        const tabs = [...document.querySelectorAll<HTMLElement>("[role='tab']")];
        const tabViewport = tabs[0]?.parentElement?.parentElement;
        return {
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            visibleCards: cards.length,
            cardOverflow: cards.some((card) => card.scrollWidth > card.clientWidth + 1),
            actionsOutsideCards: cards.some((card) => {
                const action = card.querySelector<HTMLElement>("[data-billing-plan-action]");
                if (!action) return true;
                const cardBounds = card.getBoundingClientRect();
                const actionBounds = action.getBoundingClientRect();
                return actionBounds.left < cardBounds.left - 1 || actionBounds.right > cardBounds.right + 1;
            }),
            tabViewportWidth: tabViewport?.clientWidth || 0,
            tabScrollWidth: tabViewport?.scrollWidth || 0,
        };
    });

    const mobile = testInfo.project.name.startsWith("mobile-");
    expect(layout.visibleCards).toBe(mobile ? 1 : 8);
    expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 1);
    expect(layout.cardOverflow).toBe(false);
    expect(layout.actionsOutsideCards).toBe(false);
    if (mobile) expect(layout.tabScrollWidth).toBeGreaterThan(layout.tabViewportWidth);
});

test("inspiration works fill each row before continuing down the shortest masonry column", async ({ page }, testInfo) => {
    await page.route("**/api/public/gallery?**", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ code: 0, data: { items: masonryGalleryFixture() }, msg: "OK" }),
        }),
    );
    await page.goto("/create", { waitUntil: "domcontentloaded" });

    const grid = page.locator('[aria-label="灵感作品列表"]');
    await expect(grid).toBeVisible();
    await expect(grid.locator(":scope > div")).toHaveCount(8);
    await grid.scrollIntoViewIfNeeded();
    await expect.poll(() => grid.locator('img[alt^="瀑布流测试作品"]').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);

    const viewports = testInfo.project.name === "chromium" ? [390, 430, 700, 900, 1100, 1280] : [page.viewportSize()!.width];
    for (const width of viewports) {
        await page.setViewportSize({ width, height: width < 640 ? 900 : 820 });
        const expectedColumns = width >= 1280 ? 6 : width >= 1024 ? 5 : width >= 768 ? 4 : width >= 640 ? 3 : 2;
        await expect.poll(async () => masonryLayoutIsReady(await readMasonryLayout(page), expectedColumns)).toBe(true);

        const layout = await readMasonryLayout(page);
        expect(layout.columnCount).toBe(expectedColumns);
        expect(layout.firstRowLefts).toHaveLength(expectedColumns);
        expect(new Set(layout.firstRowLefts).size).toBe(expectedColumns);
        expect(layout.firstRowLefts).toEqual([...layout.firstRowLefts].sort((left, right) => left - right));
        expect(layout.firstRowTopRange).toBeLessThanOrEqual(1);
        expect(layout.nextItemLeft).toBe(layout.shortestColumnLeft);
        expect(layout.nextItemTop).toBeGreaterThanOrEqual(layout.shortestColumnBottom - 1);
        expect(layout.nextItemTop).toBeLessThanOrEqual(layout.shortestColumnBottom + layout.rowGap * 2 + 4);
        expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 1);
        expect(layout.gridScrollWidth).toBeLessThanOrEqual(layout.gridClientWidth + 1);
        expect(layout.itemsInsideGrid).toBe(true);
    }
});

function masonryGalleryFixture() {
    const sizes = [
        [400, 800],
        [400, 300],
        [400, 600],
        [400, 240],
        [400, 500],
        [400, 700],
        [400, 360],
        [400, 560],
    ];
    return sizes.map(([width, height], index) => ({
        slug: `e2e-masonry-${index + 1}`,
        sourceType: "media",
        viewCount: index + 1,
        likeCount: 0,
        isFeatured: false,
        publishedAt: "2026-08-04T00:00:00.000Z",
        title: `瀑布流测试作品 ${index + 1}`,
        description: "",
        publicPrompt: `masonry fixture ${index + 1}`,
        category: "视觉设计",
        tags: [],
        authorName: "E2E",
        preview: {
            id: `e2e-preview-${index + 1}`,
            mediaType: "image",
            mimeType: "image/svg+xml",
            url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="hsl(${index * 42} 55% 58%)"/></svg>`)}`,
        },
    }));
}

async function readMasonryLayout(page: import("@playwright/test").Page) {
    return page.evaluate(() => {
        const grid = document.querySelector<HTMLElement>('[aria-label="灵感作品列表"]')!;
        const gridBounds = grid.getBoundingClientRect();
        const items = [...grid.children].map((item) => (item.firstElementChild as HTMLElement).getBoundingClientRect());
        const columnCount = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length;
        const firstRow = items.slice(0, columnCount);
        const shortestColumn = firstRow.reduce((shortest, item) => (item.bottom < shortest.bottom ? item : shortest));
        const nextItem = items[columnCount];
        return {
            columnCount,
            firstRowLefts: firstRow.map((item) => Math.round(item.left)),
            firstRowTopRange: Math.max(...firstRow.map((item) => item.top)) - Math.min(...firstRow.map((item) => item.top)),
            shortestColumnLeft: Math.round(shortestColumn.left),
            shortestColumnBottom: shortestColumn.bottom,
            nextItemLeft: Math.round(nextItem.left),
            nextItemTop: nextItem.top,
            rowGap: Number.parseFloat(getComputedStyle(grid).rowGap) || 0,
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            gridClientWidth: grid.clientWidth,
            gridScrollWidth: grid.scrollWidth,
            itemsInsideGrid: items.every((item) => item.left >= gridBounds.left - 1 && item.right <= gridBounds.right + 1),
        };
    });
}

function masonryLayoutIsReady(layout: Awaited<ReturnType<typeof readMasonryLayout>>, expectedColumns: number) {
    return layout.columnCount === expectedColumns && layout.firstRowLefts.length === expectedColumns && new Set(layout.firstRowLefts).size === expectedColumns && layout.firstRowTopRange <= 1 && layout.nextItemLeft === layout.shortestColumnLeft;
}

function billingProductsFixture() {
    const timestamp = "2026-08-02T00:00:00.000Z";
    return Array.from({ length: 8 }, (_, index) => ({
        id: `e2e-plan-${index + 1}`,
        productKind: "points",
        name: `E2E 创作积分包 ${index + 1}`,
        description: `用于验证多套餐响应式布局 ${index + 1}`,
        amountCents: (index + 1) * 900,
        currency: "CNY",
        pointsAmount: (index + 1) * 100,
        dailyPoints: 0,
        periodDays: 0,
        enabled: true,
        sortOrder: index,
        metadata: { recommended: index === 2, features: ["图片与视频创作", "订单和积分流水可查", "支付成功自动到账"] },
        pricing: {
            listUnitAmountCents: (index + 1) * 1_000,
            saleUnitAmountCents: (index + 1) * 900,
            discountCents: (index + 1) * 100,
            promotion: { id: `promo-${index + 1}`, label: "限时优惠", unitAmountCents: (index + 1) * 900, startsAt: timestamp, endsAt: timestamp },
        },
        createdAt: timestamp,
        updatedAt: timestamp,
    }));
}

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

async function expectDialogWithinViewport(dialog: import("@playwright/test").Locator) {
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    const viewport = dialog.page().viewportSize();
    expect(viewport).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

async function openCreativeHistory(page: import("@playwright/test").Page) {
    const dialog = page.getByRole("dialog", { name: "创作历史" });
    await expect
        .poll(async () => {
            if (await dialog.isVisible().catch(() => false)) return true;
            await page.getByRole("button", { name: "创作历史" }).click();
            return dialog.isVisible().catch(() => false);
        })
        .toBe(true);
    return dialog;
}
