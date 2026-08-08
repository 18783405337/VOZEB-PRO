import { describe, expect, it, vi } from "vitest";

import { SpecializedProviderError } from "./provider-types";
import { joinSpecializedProviderUrl, requestSpecializedProvider } from "./provider-http";

describe("specialized provider HTTP", () => {
    it("joins absolute provider paths against the configured origin", () => {
        expect(joinSpecializedProviderUrl("https://api.example.com/gateway/v1", "/api/v1/tasks/task-one")).toBe("https://api.example.com/api/v1/tasks/task-one");
        expect(joinSpecializedProviderUrl("https://api.example.com/gateway/v1/", "tasks/task-one")).toBe("https://api.example.com/gateway/v1/tasks/task-one");
    });

    it("sends bearer-authenticated JSON without exposing credentials", async () => {
        const fetcher = vi.fn(async (_url: string | URL, init?: RequestInit) => {
            expect(new Headers(init?.headers).get("authorization")).toBe("Bearer provider-secret");
            expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
            expect(init?.body).toBe(JSON.stringify({ text: "hello" }));
            return Response.json({ code: 200, data: { task_id: "task-one" } });
        });

        await expect(
            requestSpecializedProvider(
                {
                    baseUrl: "https://api.example.com",
                    apiKey: "provider-secret",
                    method: "POST",
                    path: "/api/v1/tasks",
                    body: { text: "hello" },
                    timeoutMs: 5_000,
                },
                fetcher,
            ),
        ).resolves.toEqual({ code: 200, data: { task_id: "task-one" } });
        expect(fetcher).toHaveBeenCalledWith("https://api.example.com/api/v1/tasks", expect.objectContaining({ method: "POST" }));
    });

    it("encodes GET query values and does not send a JSON body", async () => {
        const fetcher = vi.fn(async (url: string | URL, init?: RequestInit) => {
            expect(String(url)).toBe("https://api.example.com/api/v1/tasks?task_id=42&verbose=true");
            expect(init?.body).toBeUndefined();
            return Response.json({ code: 200 });
        });

        await requestSpecializedProvider(
            {
                baseUrl: "https://api.example.com",
                apiKey: "provider-secret",
                method: "GET",
                path: "/api/v1/tasks",
                query: { task_id: 42, verbose: true, blank: "" },
            },
            fetcher,
        );
    });

    it("maps non-2xx responses to typed sanitized errors", async () => {
        const fetcher = vi.fn(async () => Response.json({ message: "invalid provider-secret credential" }, { status: 401 }));

        await expect(
            requestSpecializedProvider(
                {
                    baseUrl: "https://api.example.com",
                    apiKey: "provider-secret",
                    method: "POST",
                    path: "/api/v1/tasks",
                    body: {},
                },
                fetcher,
            ),
        ).rejects.toSatisfy((error: unknown) => {
            expect(error).toBeInstanceOf(SpecializedProviderError);
            expect(error).toMatchObject({ code: "HTTP_ERROR", status: 401, retryable: false });
            expect((error as Error).message).not.toContain("provider-secret");
            expect((error as Error).message).not.toContain("Authorization");
            return true;
        });
    });

    it("maps timeout failures without leaking request credentials", async () => {
        const fetcher = vi.fn(async () => {
            throw new DOMException("Bearer provider-secret timed out", "TimeoutError");
        });

        await expect(
            requestSpecializedProvider(
                {
                    baseUrl: "https://api.example.com",
                    apiKey: "provider-secret",
                    method: "GET",
                    path: "/api/v1/tasks/task-one",
                },
                fetcher,
            ),
        ).rejects.toMatchObject({ code: "TIMEOUT", retryable: true, message: "Provider request timed out" });
    });
});
