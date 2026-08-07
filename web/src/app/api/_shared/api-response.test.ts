import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/server/authorization/authorization-service";
import { TenantContextError } from "@/lib/server/tenant/tenant-context";

import { apiCompatError, apiError, apiOk, apiSuccess } from "./api-response";

describe("API response helpers", () => {
    it("creates the shared success envelope", async () => {
        const response = apiSuccess({ id: "one" }, "已创建", { status: 201 });

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({ code: 0, data: { id: "one" }, msg: "已创建" });
    });

    it("supports strict and legacy-compatible error envelopes", async () => {
        await expect(apiError(403, "需要管理员权限").json()).resolves.toEqual({ code: 403, data: null, msg: "需要管理员权限" });
        await expect(apiCompatError(400, "输入有误").json()).resolves.toEqual({ code: 400, data: null, msg: "输入有误", error: "输入有误" });
    });

    it("creates the SaaS success envelope with an explicit status", async () => {
        const response = apiOk({ id: "tenant-one" }, 201);

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({ code: 0, data: { id: "tenant-one" }, msg: "" });
    });

    it("maps authorization and tenant context errors to their HTTP status", async () => {
        const authorization = apiError(new AuthorizationError("Denied", 403, "tenant.permission_denied"), "Fallback", "tenant.route");
        const tenant = apiError(new TenantContextError("Missing", 404, "tenant.not_found"), "Fallback", "tenant.route");

        expect(authorization.status).toBe(403);
        await expect(authorization.json()).resolves.toEqual({ code: 403, data: null, msg: "Denied" });
        expect(tenant.status).toBe(404);
        await expect(tenant.json()).resolves.toEqual({ code: 404, data: null, msg: "Missing" });
    });

    it("logs unexpected errors and returns the fallback response", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const error = new Error("database failed");

        const response = apiError(error, "Request failed", "tenant.route");

        expect(consoleError).toHaveBeenCalledWith("tenant.route", error);
        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ code: 500, data: null, msg: "Request failed" });
        consoleError.mockRestore();
    });
});
