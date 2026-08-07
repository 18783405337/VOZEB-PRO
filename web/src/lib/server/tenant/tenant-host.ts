import { getTrustedProxyHops } from "@/lib/server/security";

export type TenantLookup = {
    hostname?: string;
    slug?: string;
};

export function resolveTenantLookup(request: Request): TenantLookup {
    const url = new URL(request.url);
    const slugMatch = url.pathname.match(/^\/t\/([a-z0-9][a-z0-9-]{0,62})(?:\/|$)/i);
    const forwardedHost = getTrustedProxyHops() > 0 ? firstHeaderValue(request.headers.get("x-forwarded-host")) : undefined;
    const hostname = normalizeHostname(forwardedHost || request.headers.get("host") || url.host);

    return {
        ...(hostname ? { hostname } : {}),
        ...(slugMatch?.[1] ? { slug: slugMatch[1].toLowerCase() } : {}),
    };
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
