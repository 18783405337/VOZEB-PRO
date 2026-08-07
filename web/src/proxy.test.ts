import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    json: vi.fn(),
    next: vi.fn(),
}));

vi.mock("next/server", () => ({
    NextResponse: {
        json: mocks.json,
        next: mocks.next,
    },
}));

import type { NextRequest } from "next/server";
import { proxy } from "./proxy";

function request(pathname: string, method = "GET") {
    const url = new URL(`https://public.example.com${pathname}`);
    return {
        method,
        headers: new Headers({
            host: "public.example.com",
            "x-request-id": "request-one",
            "x-vozeb-tenant-id": "spoofed-tenant",
            "x-vozeb-tenant-signature": "spoofed-signature",
        }),
        nextUrl: {
            host: url.host,
            pathname: url.pathname,
            protocol: url.protocol,
        },
    } as unknown as NextRequest;
}

describe("proxy tenant header sanitation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.next.mockReturnValue({ status: 200 });
    });

    it.each([
        ["/api/apps", "GET"],
        ["/api/billing/webhooks/alipay", "POST"],
        ["/api/apps", "POST"],
    ])("removes internal tenant headers for %s %s", (pathname, method) => {
        proxy(request(pathname, method));

        const options = mocks.next.mock.calls[0]?.[0] as { request?: { headers?: Headers } };
        const headers = options.request?.headers;
        expect(headers).toBeInstanceOf(Headers);
        expect(headers?.get("x-vozeb-tenant-id")).toBeNull();
        expect(headers?.get("x-vozeb-tenant-signature")).toBeNull();
        expect(headers?.get("x-request-id")).toBe("request-one");
    });
});
