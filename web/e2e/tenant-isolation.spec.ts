import { expect, test } from "@playwright/test";

import { createTenantImageTask, pollTask, requiredEnv } from "./support";

test("tenant A cannot read tenant B task or asset", async ({ browser }) => {
    const tenantA = await browser.newContext({
        baseURL: requiredEnv("E2E_TENANT_A_URL"),
        storageState: requiredEnv("E2E_TENANT_A_STORAGE_STATE"),
    });
    const tenantB = await browser.newContext({
        baseURL: requiredEnv("E2E_TENANT_B_URL"),
        storageState: requiredEnv("E2E_TENANT_B_STORAGE_STATE"),
    });

    try {
        const task = await createTenantImageTask(tenantA.request, "tenant isolation");
        const taskResponse = await tenantB.request.get(`/api/image-tasks/${task.id}`);
        expect(taskResponse.status()).toBe(404);

        const completed = await pollTask(tenantA.request, `/api/image-tasks/${task.id}`);
        expect(completed).toMatchObject({ status: "success" });
        const assetUrl = String((completed.result as { dataUrl?: string } | undefined)?.dataUrl || "");
        expect(assetUrl).toMatch(/^\/api\/generation-log-assets\//);

        const assetResponse = await tenantB.request.get(assetUrl);
        expect(assetResponse.status()).toBe(404);
    } finally {
        await tenantA.close();
        await tenantB.close();
    }
});
