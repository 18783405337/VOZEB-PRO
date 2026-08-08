import { afterEach, describe, expect, it, vi } from "vitest";

import { getTenantBillingOverview } from "./tenant-billing";

describe("tenant billing API client", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("loads the tenant-scoped billing overview", async () => {
        const overview = {
            wallets: [],
            power: [],
            settlement: [],
            orders: { items: [], total: 0, page: 1, pageSize: 20 },
            merchants: [],
            reconciliation: { items: [], total: 0, page: 1, pageSize: 10 },
            generatedAt: "2026-08-08T00:00:00.000Z",
        };
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { overview }, msg: "" }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(getTenantBillingOverview()).resolves.toEqual(overview);
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/tenant/billing/overview",
            expect.objectContaining({ cache: "no-store", credentials: "include" }),
        );
    });
});
