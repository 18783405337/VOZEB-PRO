import type { TenantDomainRecord } from "@/lib/server/tenant/tenant-types";
import { requestApiData } from "./api-envelope";

export async function verifyTenantDomain(domainId: string) {
    return (await requestApiData<{ domain: TenantDomainRecord }>(`/api/tenant/domains/${encodeURIComponent(domainId)}/verify`, { method: "POST" })).domain;
}
