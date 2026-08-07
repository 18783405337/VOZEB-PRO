import { headers } from "next/headers";

import { getTenantContext } from "@/lib/server/tenant/tenant-context";

export async function getTenantPageContext(pathname: string) {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host") || "localhost";
    const request = new Request(`http://${host}${pathname}`, { headers: new Headers(requestHeaders) });
    return getTenantContext(request, { requireMembership: true });
}
