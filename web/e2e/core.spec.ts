import { createHmac, randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E_PAYMENT_WEBHOOK_SECRET, pollTask, protocolFixtureState, resetProtocolFixture } from "./support";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
    await resetProtocolFixture(request);
});

test("text tasks return content, fail over automatically, and surface terminal failures", async ({ request }) => {
    const fallback = await request.post("/api/text-tasks", { data: { config: { model: "e2e-text-fallback" }, messages: [{ role: "user", content: "protocol fallback" }] } });
    expect(fallback.ok(), await fallback.text()).toBe(true);
    const fallbackTask = ((await fallback.json()) as { task: { id: string } }).task;
    const completed = await pollTask(request, `/api/text-tasks/${fallbackTask.id}`);
    expect(completed).toMatchObject({ status: "success", result: { content: "协议测试文本返回成功" } });
    const state = await protocolFixtureState(request);
    expect(state.requests.filter((item) => item.method === "POST" && item.path.endsWith("/chat/completions"))).toMatchObject([
        { authorization: "Bearer e2e-primary-secret", model: "e2e-text-fallback" },
        { authorization: "Bearer e2e-backup-secret", model: "e2e-text-fallback" },
    ]);

    const failed = await request.post("/api/text-tasks", { data: { config: { model: "e2e-text-fail" }, messages: [{ role: "user", content: "protocol failure" }] } });
    expect(failed.ok(), await failed.text()).toBe(true);
    const failedTask = ((await failed.json()) as { task: { id: string } }).task;
    expect(await pollTask(request, `/api/text-tasks/${failedTask.id}`)).toMatchObject({ status: "error" });
});

test("image task persists a real media result and reuses the same request identity", async ({ request }) => {
    const clientRequestId = `e2e-image:${randomUUID()}`;
    const body = { kind: "generation", config: { model: "e2e-image", quality: "standard", size: "64x64" }, prompt: "blue image", source: "image-workbench", context: { clientRequestId } };
    const headers = { "X-VOZEB-PRO-Client-Request-Id": clientRequestId };
    const created = await request.post("/api/image-tasks", { data: body, headers });
    expect(created.ok(), await created.text()).toBe(true);
    const firstTask = ((await created.json()) as { task: { id: string } }).task;
    const replay = await request.post("/api/image-tasks", { data: body, headers });
    expect(replay.ok()).toBe(true);
    expect((await replay.json()).task.id).toBe(firstTask.id);
    const completed = await pollTask(request, `/api/image-tasks/${firstTask.id}`);
    expect(completed).toMatchObject({ status: "success", result: { width: 64, height: 64, mimeType: "image/png" } });
    const mediaUrl = String((completed.result as { dataUrl?: string }).dataUrl || "");
    expect(mediaUrl).toMatch(/^\/api\/generation-log-assets\/permanent\/.+\.png$/);
    const media = await request.get(mediaUrl);
    expect(media.ok()).toBe(true);
    expect(media.headers()["content-type"]).toMatch(/^image\/png/);
    expect(Array.from((await media.body()).subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const state = await protocolFixtureState(request);
    expect(state.requests.filter((item) => item.method === "POST" && item.path.endsWith("/images/generations"))).toHaveLength(1);
});

test("image workbench keeps both consecutive generation results after refresh", async ({ page, request }) => {
    await page.goto("/image", { waitUntil: "domcontentloaded" });
    const prompt = page.getByPlaceholder("今天我们要创作什么，可直接粘贴文字或图片");
    const generate = page.getByRole("button", { name: /开始生成/ });

    await prompt.fill("生成小狗");
    await generate.click();
    await expect(page.getByTestId("image-result-card")).toHaveCount(1, { timeout: 30_000 });

    await prompt.fill("生成唐老鸭");
    await generate.click();
    await expect(page.getByText("生成小狗", { exact: true })).toHaveCount(1);
    await expect(page.getByText("生成唐老鸭", { exact: true })).toHaveCount(1);
    await expect(page.getByTestId("image-result-card")).toHaveCount(2, { timeout: 30_000 });

    await expect.poll(async () => (await protocolFixtureState(request)).requests.filter((item) => item.method === "POST" && item.path.endsWith("/images/generations")).length).toBe(2);
    await expect(page.getByTestId("image-result-card")).toHaveCount(2);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("生成小狗", { exact: true })).toHaveCount(1);
    await expect(page.getByText("生成唐老鸭", { exact: true })).toHaveCount(1);
    await expect(page.getByTestId("image-result-card")).toHaveCount(2, { timeout: 30_000 });

    await page.getByRole("button", { name: "生成记录" }).click();
    await expect(page.getByTestId("workbench-history-card").filter({ hasText: "生成小狗" })).toHaveCount(1);
});

test("video request replay and cancellation keep one upstream task", async ({ request }) => {
    const clientRequestId = `e2e-video:${randomUUID()}`;
    const body = { config: { model: "e2e-video-slow", size: "16:9", vquality: "720", videoSeconds: 5 }, prompt: "slow video", source: "video-workbench", context: { clientRequestId } };
    const headers = { "X-VOZEB-PRO-Client-Request-Id": clientRequestId };
    const created = await request.post("/api/video-generation-tasks", { data: body, headers });
    expect(created.ok(), await created.text()).toBe(true);
    const firstTask = ((await created.json()) as { task: { id: string } }).task;
    const replay = await request.post("/api/video-generation-tasks", { data: body, headers });
    expect(replay.ok()).toBe(true);
    expect((await replay.json()).task.id).toBe(firstTask.id);
    await expect.poll(async () => (await protocolFixtureState(request)).requests.filter((item) => item.method === "POST" && item.path.endsWith("/videos")).length).toBe(1);

    const cancelled = await request.patch(`/api/video-tasks/${firstTask.id}`, { data: { action: "cancel" } });
    expect(cancelled.ok(), await cancelled.text()).toBe(true);
    expect(await pollTask(request, `/api/video-tasks/${firstTask.id}`)).toMatchObject({ status: "cancelled" });
    const state = await protocolFixtureState(request);
    expect(state.requests.filter((item) => item.method === "POST" && item.path.endsWith("/videos"))).toHaveLength(1);
});

test("video workbench prevents rapid duplicate submissions and restores cancellation after refresh", async ({ page, request }) => {
    let planningRequests = 0;
    await page.route("**/api/agent/workbench", async (route) => {
        planningRequests += 1;
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                code: 0,
                data: {
                    intent: "generation",
                    parameterPatch: { model: "e2e-video-slow", size: "16:9", vquality: "720", videoSeconds: 5 },
                    resolvedPrompt: "slow video",
                    shouldGenerate: true,
                    reply: "开始生成。",
                    choices: [],
                    deliverables: [],
                },
                msg: "OK",
            }),
        });
    });

    await page.goto("/video", { waitUntil: "domcontentloaded" });
    const prompt = page.getByPlaceholder("今天我们要创作什么，可直接粘贴文字或素材");
    const generate = page.getByRole("button", { name: /开始生成/ });
    await expect(generate).toHaveAttribute("aria-label", /消耗 0 积分/);
    await prompt.fill("生成一段慢速测试视频");
    await expect(prompt).toHaveValue("生成一段慢速测试视频");
    await expect(generate).toBeEnabled();
    await generate.evaluate((button) => {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await expect.poll(() => planningRequests).toBe(1);
    await expect.poll(async () => (await protocolFixtureState(request)).requests.filter((item) => item.method === "POST" && item.path.endsWith("/videos")).length).toBe(1);
    const createdRequest = (await protocolFixtureState(request)).requests.find((item) => item.method === "POST" && item.path.endsWith("/videos"));
    expect(createdRequest?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(createdRequest?.model).toBe("e2e-video-slow");
    await expect(page.getByRole("button", { name: "取消任务" }).first()).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "取消任务" }).first()).toBeVisible();
    await page.getByRole("button", { name: "取消任务" }).first().click();
    await expect(page.getByText("任务已取消").first()).toBeVisible();
    await expect.poll(async () => (await protocolFixtureState(request)).requests.filter((item) => item.method === "POST" && item.path.endsWith("/videos")).length).toBe(1);

    await prompt.fill("取消后再次生成慢速测试视频");
    await expect(generate).toBeEnabled();
    await generate.click();
    await expect.poll(() => planningRequests).toBe(2);
    await expect.poll(async () => (await protocolFixtureState(request)).requests.filter((item) => item.method === "POST" && item.path.endsWith("/videos")).length).toBe(2);
    await expect(page.getByRole("button", { name: "取消任务" }).first()).toBeVisible();
    await page.getByRole("button", { name: "取消任务" }).first().click();
});

test("video workbench restores a successful result after refresh", async ({ page }) => {
    await page.goto("/video", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "智能规划已开启，点击关闭" }).click();
    await expect(page.getByText("选择生成模型", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "e2e-video", exact: true }).click();
    await page.keyboard.press("Escape");

    const prompt = page.getByPlaceholder("今天我们要创作什么，可直接粘贴文字或素材");
    const generate = page.getByRole("button", { name: /开始生成/ });
    await prompt.fill("生成一段刷新后仍然显示的测试视频");
    await expect(generate).toBeEnabled();
    await generate.click();
    await expect(page.locator("video")).toHaveCount(1, { timeout: 30_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("生成一段刷新后仍然显示的测试视频", { exact: true })).toHaveCount(1);
    await expect(page.locator("video")).toHaveCount(1, { timeout: 30_000 });
});

test("audio task stores a valid audio result", async ({ request }) => {
    const created = await request.post("/api/audio-tasks", { data: { config: { model: "e2e-audio", voice: "alloy", format: "wav" }, prompt: "audio fixture", source: "agent", context: { clientRequestId: `e2e-audio:${randomUUID()}` } } });
    expect(created.ok(), await created.text()).toBe(true);
    const task = ((await created.json()) as { task: { id: string } }).task;
    expect(await pollTask(request, `/api/audio-tasks/${task.id}`)).toMatchObject({ status: "success", result: { mimeType: "audio/wav" } });
});

test("canvas projects round-trip two nodes and one connection", async ({ request }) => {
    const created = await request.post("/api/canvas/projects", {
        data: {
            title: "E2E Canvas",
            project: {
                nodes: [
                    { id: "node-a", type: "text", title: "需求", position: { x: 10, y: 20 }, width: 240, height: 120, metadata: { content: "生成测试" } },
                    { id: "node-b", type: "config", title: "配置", position: { x: 360, y: 20 }, width: 240, height: 160, metadata: { size: "1280x720" } },
                ],
                connections: [{ id: "edge-a-b", fromNodeId: "node-a", toNodeId: "node-b" }],
            },
        },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const project = ((await created.json()) as { data: { project: { id: string } } }).data.project;
    const loaded = await request.get(`/api/canvas/projects/${project.id}`);
    expect(loaded.ok()).toBe(true);
    expect(await loaded.json()).toMatchObject({ data: { project: { nodes: [{ id: "node-a" }, { id: "node-b" }], connections: [{ id: "edge-a-b", fromNodeId: "node-a", toNodeId: "node-b" }] } } });
});

test("new Agent Skill is saved before leaving the administrator page", async ({ page, request }) => {
    const beforeResponse = await request.get("/api/admin/settings");
    expect(beforeResponse.ok(), await beforeResponse.text()).toBe(true);
    const before = ((await beforeResponse.json()) as { settings: { agentSkills: unknown[] } }).settings.agentSkills;
    const skillName = `E2E 持久 Skill ${randomUUID().slice(0, 8)}`;

    try {
        await page.goto("/admin?section=skills");
        await page.getByRole("button", { name: "新增 Skill" }).click();
        await page.getByText("手动创建", { exact: true }).click();
        await page.getByLabel("Skill 名称").fill(skillName);
        await page.getByLabel("执行规则").fill("保持用户需求不变，按当前工作台能力规划并执行。");
        await page.getByRole("button", { name: "添加并保存" }).click();
        await expect(page.getByText("Agent Skill 已添加并保存", { exact: true })).toBeVisible();

        await page.goto("/create");
        await page.goto("/admin?section=skills");
        await expect(page.getByText(skillName, { exact: true })).toBeVisible();

        const persistedResponse = await request.get("/api/admin/settings");
        expect(persistedResponse.ok(), await persistedResponse.text()).toBe(true);
        const persisted = ((await persistedResponse.json()) as { settings: { agentSkills: Array<{ name?: string }> } }).settings.agentSkills;
        expect(persisted.some((skill) => skill.name === skillName)).toBe(true);
    } finally {
        const restored = await request.patch("/api/admin/settings", { data: { agentSkills: before } });
        expect(restored.ok(), await restored.text()).toBe(true);
    }
});

test("PostgreSQL payment flow verifies missing fields, rejects trade reuse, and refunds", async ({ request }) => {
    test.skip(!process.env.VOZEB_PRO_E2E_DATABASE_URL, "需要专用 PostgreSQL E2E 数据库");
    const productResponse = await request.post("/api/admin/billing/products", {
        data: { productKind: "points", name: `E2E 积分包 ${randomUUID().slice(0, 8)}`, description: "E2E", amountCents: 100, currency: "CNY", pointsAmount: 100, enabled: true },
    });
    expect(productResponse.ok(), await productResponse.text()).toBe(true);
    const product = ((await productResponse.json()) as { product: { id: string } }).product;

    const firstOrder = await createOrder(request, product.id);
    const checkout = await request.post(`/api/billing/orders/${firstOrder.id}/checkout`, { data: { provider: "payply" } });
    expect(checkout.ok(), await checkout.text()).toBe(true);
    expect(await checkout.json()).toMatchObject({ code: 0, data: { checkout: { kind: "redirect", provider: "payply" } } });

    const firstWebhookBody = JSON.stringify({ eventId: `event-${randomUUID()}`, status: "succeeded", orderId: firstOrder.id, orderNo: firstOrder.orderNo, providerTradeId: "payply_trade_e2e", providerPaymentId: "payply_payment_e2e" });
    const firstWebhook = await postSignedWebhook(request, firstWebhookBody);
    expect(firstWebhook.ok(), await firstWebhook.text()).toBe(true);
    expect(await firstWebhook.json()).toMatchObject({ orderId: firstOrder.id, orderStatus: "paid" });
    const duplicate = await postSignedWebhook(request, firstWebhookBody);
    expect(duplicate.ok()).toBe(true);
    expect(await duplicate.json()).toMatchObject({ duplicate: true, orderId: firstOrder.id });

    const secondOrder = await createOrder(request, product.id);
    const conflictBody = JSON.stringify({ eventId: `event-${randomUUID()}`, status: "succeeded", orderId: secondOrder.id, orderNo: secondOrder.orderNo, providerTradeId: "payply_trade_e2e", providerPaymentId: "payply_payment_conflict" });
    const conflict = await postSignedWebhook(request, conflictBody);
    expect(conflict.status()).toBe(409);

    const refund = await request.post(`/api/admin/billing/orders/${firstOrder.id}/refund`, { data: { reason: "E2E 退款" } });
    expect(refund.ok(), await refund.text()).toBe(true);
    expect(await refund.json()).toMatchObject({ order: { id: firstOrder.id, status: "refunded" }, providerRefund: { provider: "payply", status: "succeeded" } });
});

async function createOrder(request: APIRequestContext, productId: string) {
    const response = await request.post("/api/billing/orders", { data: { productId, quantity: 1, provider: "payply" } });
    expect(response.ok(), await response.text()).toBe(true);
    return ((await response.json()) as { order: { id: string; orderNo: string } }).order;
}

async function postSignedWebhook(request: APIRequestContext, rawBody: string) {
    const signature = createHmac("sha256", E2E_PAYMENT_WEBHOOK_SECRET).update(rawBody).digest("hex");
    return request.post("/api/billing/webhooks/payply", { data: rawBody, headers: { "content-type": "application/json", "x-vozeb-pro-signature": signature } });
}
