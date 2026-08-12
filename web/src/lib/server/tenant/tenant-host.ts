import { getTrustedProxyHops } from "@/lib/server/security";

export type TenantLookup = {
    hostname?: string;
    slug?: string;
    defaultHostAllowed: boolean;
};

export function resolveTenantLookup(request: Request): TenantLookup {
    const url = new URL(request.url);
    const slugMatch = url.pathname.match(/^\/t\/([a-z0-9][a-z0-9-]{0,62})(?:\/|$)/i);
    const forwardedHost = getTrustedProxyHops() > 0 ? firstHeaderValue(request.headers.get("x-forwarded-host")) : undefined;
    const hostname = normalizeHostname(forwardedHost || request.headers.get("host") || url.host);

    return {
        ...(hostname ? { hostname } : {}),
        ...(slugMatch?.[1] ? { slug: slugMatch[1].toLowerCase() } : {}),
        defaultHostAllowed: isDefaultTenantHost(hostname),
    };
}

function isDefaultTenantHost(hostname: string | undefined) {
    if (!hostname) return false;
    return defaultTenantHosts().has(hostname);
}

function defaultTenantHosts() {
    const hosts = new Set(["localhost", "127.0.0.1", "::1"]);
    for (const value of process.env.VOZEB_PRO_PLATFORM_HOSTS?.split(",") || []) {
        const hostname = normalizeHostname(value);
        if (hostname) hosts.add(hostname);
    }
    try {
        const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
        if (configured) hosts.add(new URL(configured).hostname.toLowerCase().replace(/\.$/, ""));
    } catch {
        // Invalid public URLs are handled by deployment readiness checks.
    }
    return hosts;
}

function firstHeaderValue(value: string | null) {
    return value?.split(",")[0]?.trim();
}

function normalizeHostname(value: string | null | undefined) {
    const candidate = value?.trim().replace(/\.$/, "");
    if (!candidate) return undefined;

    try {
        return new URL(`http://${candidate}`).hostname.toLowerCase().replace(/\.$/, "") || undefined;
    } catch {
        return undefined;
    }
}
