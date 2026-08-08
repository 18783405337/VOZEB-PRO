import { afterEach, describe, expect, it, vi } from "vitest";

import {
    clearTenantApplicationProviderBinding,
    getTenantApplicationProviderBinding,
    installTenantApp,
    listTenantApplications,
    publishApplicationVersion,
    saveTenantApplicationProviderBinding,
} from "./app-center";

describe("application center API client", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("loads the tenant application catalog without exposing credentials", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    code: 0,
                    data: {
                        available: [{ appKey: "background-removal", version: "1.0.0", definition: { name: "Background Removal" } }],
                        installed: [],
                    },
                    msg: "",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        await expect(listTenantApplications()).resolves.toMatchObject({ available: expect.any(Array), installed: [] });
        expect(fetchMock).toHaveBeenCalledWith("/api/tenant/apps", expect.objectContaining({ credentials: "include", cache: "no-store" }));
    });

    it("installs an application and publishes platform versions through the matching endpoints", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: { app: { appKey: "background-removal" } }, msg: "" }), { status: 201 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: { app: { appKey: "background-removal" } }, msg: "" }), { status: 201 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(installTenantApp("background-removal", "1.0.0")).resolves.toMatchObject({ appKey: "background-removal" });
        await expect(publishApplicationVersion("background-removal", "1.0.0")).resolves.toMatchObject({ appKey: "background-removal" });
        expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/tenant/apps");
        expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/apps/background-removal/versions");
    });

    it("loads, saves, and clears one logical API subscription for a tenant application", async () => {
        const response = {
            binding: {
                logicalModelKey: "digital-human-kling",
                name: "Kling Digital Human",
                status: "enabled",
            },
            available: [
                {
                    logicalModelKey: "digital-human-kling",
                    name: "Kling Digital Human",
                },
            ],
        };
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: response, msg: "" }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: response, msg: "" }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: { ...response, binding: null }, msg: "" }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(getTenantApplicationProviderBinding("aigc-digital-human")).resolves.toEqual(response);
        await expect(saveTenantApplicationProviderBinding("aigc-digital-human", "digital-human-kling")).resolves.toEqual(response);
        await expect(clearTenantApplicationProviderBinding("aigc-digital-human")).resolves.toEqual({ ...response, binding: null });

        const path = "/api/tenant/apps/aigc-digital-human/provider-binding";
        expect(fetchMock.mock.calls[0]?.[0]).toBe(path);
        expect(fetchMock.mock.calls[1]?.[0]).toBe(path);
        expect(fetchMock.mock.calls[1]?.[1]).toEqual(
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ logicalModelKey: "digital-human-kling" }),
            }),
        );
        expect(fetchMock.mock.calls[2]?.[0]).toBe(path);
        expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: "DELETE" }));
        expect(response.binding).not.toHaveProperty("channelId");
        expect(response.binding).not.toHaveProperty("baseUrl");
        expect(response.binding).not.toHaveProperty("apiKey");
    });
});
