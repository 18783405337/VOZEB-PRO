import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), proxyUrl: vi.fn(() => "") }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("@/lib/server/proxy-dispatcher", () => ({ resolveServerProxyUrl: mocks.proxyUrl }));

import { fetchSafeOutbound, UnsafeOutboundUrlError } from "./safe-outbound-fetch";

describe("safe outbound fetch TCP pinning", () => {
    beforeEach(() => {
        vi.stubEnv("VOZEB_PRO_ALLOW_PRIVATE_UPSTREAMS", "1");
        vi.stubEnv("VOZEB_PRO_PRIVATE_UPSTREAM_HOSTS", "provider.internal");
        mocks.lookup.mockImplementation(async (hostname: string) => (hostname === "provider.internal" ? [{ address: "127.0.0.1", family: 4 }] : [{ address: "10.0.0.8", family: 4 }]));
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it("connects to the validated IP while sending the original Host header", async () => {
        let receivedHost = "";
        const server = createServer((request, response) => {
            receivedHost = request.headers.host || "";
            response.setHeader("content-type", "application/json");
            response.end(JSON.stringify({ ok: true }));
        });
        await listen(server);
        const port = (server.address() as AddressInfo).port;
        try {
            const response = await fetchSafeOutbound(`http://provider.internal:${port}/probe`);
            await expect(response.json()).resolves.toEqual({ ok: true });
            expect(receivedHost).toBe(`provider.internal:${port}`);
        } finally {
            await close(server);
        }
    });

    it("revalidates every redirect before opening the next connection", async () => {
        const server = createServer((_request, response) => {
            response.statusCode = 302;
            response.setHeader("location", "http://169.254.169.254/latest/meta-data");
            response.end();
        });
        await listen(server);
        const port = (server.address() as AddressInfo).port;
        try {
            await expect(fetchSafeOutbound(`http://provider.internal:${port}/redirect`)).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
        } finally {
            await close(server);
        }
    });
});

function listen(server: ReturnType<typeof createServer>) {
    return new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => resolve());
    });
}

function close(server: ReturnType<typeof createServer>) {
    return new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
