import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveTenantLookup } from "./tenant-host";

const originalTrustedProxyHops = process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;

describe("resolveTenantLookup", () => {
    beforeEach(() => {
        delete process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
    });

    afterEach(() => {
        if (originalTrustedProxyHops === undefined) delete process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
        else process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS = originalTrustedProxyHops;
    });

    it("extracts a normalized hostname and tenant path slug", () => {
        const request = new Request("https://Studio.Example.com:8443/t/Tenant-One/apps");

        expect(resolveTenantLookup(request)).toEqual({
            hostname: "studio.example.com",
            slug: "tenant-one",
        });
    });

    it("ignores public tenant identity headers", () => {
        const request = new Request("https://public.example.com/api/apps", {
            headers: {
                "x-tenant-id": "spoofed-tenant",
                "x-vozeb-tenant-id": "spoofed-internal-tenant",
            },
        });

        expect(resolveTenantLookup(request)).toEqual({ hostname: "public.example.com" });
    });

    it("ignores forwarded hosts when no trusted proxy is configured", () => {
        const request = new Request("https://origin.example.com/api/apps", {
            headers: { "x-forwarded-host": "tenant.example.com" },
        });

        expect(resolveTenantLookup(request)).toEqual({ hostname: "origin.example.com" });
    });

    it("uses the first forwarded host from a trusted proxy", () => {
        process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS = "1";
        const request = new Request("https://origin.example.com/api/apps", {
            headers: { "x-forwarded-host": "Tenant.Example.com:443, edge.internal" },
        });

        expect(resolveTenantLookup(request)).toEqual({ hostname: "tenant.example.com" });
    });

    it("does not treat malformed tenant paths as slugs", () => {
        const request = new Request("https://public.example.com/t/-invalid/apps");

        expect(resolveTenantLookup(request)).toEqual({ hostname: "public.example.com" });
    });
});
