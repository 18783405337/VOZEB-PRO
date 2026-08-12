import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveTenantLookup } from "./tenant-host";

const originalTrustedProxyHops = process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
const originalPlatformHosts = process.env.VOZEB_PRO_PLATFORM_HOSTS;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

describe("resolveTenantLookup", () => {
    beforeEach(() => {
        delete process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
        process.env.VOZEB_PRO_PLATFORM_HOSTS = "public.example.com";
        delete process.env.NEXT_PUBLIC_SITE_URL;
    });

    afterEach(() => {
        if (originalTrustedProxyHops === undefined) delete process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS;
        else process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS = originalTrustedProxyHops;
        if (originalPlatformHosts === undefined) delete process.env.VOZEB_PRO_PLATFORM_HOSTS;
        else process.env.VOZEB_PRO_PLATFORM_HOSTS = originalPlatformHosts;
        if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    });

    it("extracts a normalized hostname and tenant path slug", () => {
        const request = new Request("https://Studio.Example.com:8443/t/Tenant-One/apps");

        expect(resolveTenantLookup(request)).toEqual({
            hostname: "studio.example.com",
            slug: "tenant-one",
            defaultHostAllowed: false,
        });
    });

    it("ignores public tenant identity headers", () => {
        const request = new Request("https://public.example.com/api/apps", {
            headers: {
                "x-tenant-id": "spoofed-tenant",
                "x-vozeb-tenant-id": "spoofed-internal-tenant",
            },
        });

        expect(resolveTenantLookup(request)).toEqual({ hostname: "public.example.com", defaultHostAllowed: true });
    });

    it("ignores forwarded hosts when no trusted proxy is configured", () => {
        const request = new Request("https://origin.example.com/api/apps", {
            headers: { "x-forwarded-host": "tenant.example.com" },
        });

        expect(resolveTenantLookup(request)).toEqual({ hostname: "origin.example.com", defaultHostAllowed: false });
    });

    it("uses the first forwarded host from a trusted proxy", () => {
        process.env.VOZEB_PRO_TRUSTED_PROXY_HOPS = "1";
        const request = new Request("https://origin.example.com/api/apps", {
            headers: { "x-forwarded-host": "Tenant.Example.com:443, edge.internal" },
        });

        expect(resolveTenantLookup(request)).toEqual({ hostname: "tenant.example.com", defaultHostAllowed: false });
    });

    it("does not treat malformed tenant paths as slugs", () => {
        const request = new Request("https://public.example.com/t/-invalid/apps");

        expect(resolveTenantLookup(request)).toEqual({ hostname: "public.example.com", defaultHostAllowed: true });
    });

    it("allows the configured public site host to use the default tenant", () => {
        delete process.env.VOZEB_PRO_PLATFORM_HOSTS;
        process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";

        expect(resolveTenantLookup(new Request("https://app.example.com/api/apps"))).toEqual({ hostname: "app.example.com", defaultHostAllowed: true });
        expect(resolveTenantLookup(new Request("https://unknown.example.com/api/apps"))).toEqual({ hostname: "unknown.example.com", defaultHostAllowed: false });
    });
});
