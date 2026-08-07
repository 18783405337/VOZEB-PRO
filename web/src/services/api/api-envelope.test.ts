import { afterEach, describe, expect, it, vi } from "vitest";

import { requestApiData } from "./api-envelope";

describe("API envelope client", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns data from a successful envelope with session credentials", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 0, data: { id: "tenant-a" }, msg: "" }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(requestApiData<{ id: string }>("/api/tenant/context")).resolves.toEqual({ id: "tenant-a" });
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/tenant/context",
            expect.objectContaining({
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            }),
        );
    });

    it("throws the server message for a failed envelope", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: 403, data: null, msg: "需要成员权限" }, { status: 403 })));

        await expect(requestApiData("/api/tenant/members")).rejects.toThrow("需要成员权限");
    });
});
