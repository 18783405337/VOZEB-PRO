import type { TenantDomainRecord, TenantListResult, TenantRecord, TenantStatus } from "@/lib/server/tenant/tenant-types";

import { requestApiData } from "./api-envelope";

export type PlatformTenantListOptions = {
    keyword?: string;
    status?: TenantStatus;
    page?: number;
    pageSize?: number;
};

export function listPlatformTenants(options: PlatformTenantListOptions = {}) {
    const params = new URLSearchParams();
    if (options.keyword) params.set("keyword", options.keyword);
    if (options.status) params.set("status", options.status);
    if (options.page) params.set("page", String(options.page));
    if (options.pageSize) params.set("pageSize", String(options.pageSize));
    const query = params.toString();
    return requestApiData<TenantListResult>(`/api/admin/tenants${query ? `?${query}` : ""}`, { cache: "no-store" });
}

export async function createPlatformTenant(input: { slug: string; name: string; ownerUserId?: string }) {
    return (await requestApiData<{ tenant: TenantRecord }>("/api/admin/tenants", {
        method: "POST",
        body: JSON.stringify(input),
    })).tenant;
}

export async function getPlatformTenantSettings(tenantId: string) {
    return (await requestApiData<{ settings: Record<string, unknown> }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/settings`, { cache: "no-store" })).settings;
}

export async function updatePlatformTenantSettings(tenantId: string, settings: Record<string, unknown>) {
    return (await requestApiData<{ settings: Record<string, unknown> }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/settings`, {
        method: "PATCH",
        body: JSON.stringify(settings),
    })).settings;
}

export async function updatePlatformTenant(tenantId: string, patch: { name?: string; status?: TenantStatus; ownerUserId?: string }) {
    return (await requestApiData<{ tenant: TenantRecord }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    })).tenant;
}

export async function listPlatformTenantDomains(tenantId: string) {
    return (await requestApiData<{ domains: TenantDomainRecord[] }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/domains`, { cache: "no-store" })).domains;
}

export async function createPlatformTenantDomain(tenantId: string, input: { hostname: string; kind: "custom" | "subdomain" }) {
    return (await requestApiData<{ domain: TenantDomainRecord }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/domains`, {
        method: "POST",
        body: JSON.stringify(input),
    })).domain;
}

export async function verifyPlatformTenantDomain(tenantId: string, domainId: string) {
    return (await requestApiData<{ domain: TenantDomainRecord }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/domains/${encodeURIComponent(domainId)}/verify`, { method: "POST" })).domain;
}

export async function updatePlatformTenantDomain(tenantId: string, domainId: string, status: "pending" | "disabled") {
    return (await requestApiData<{ domain: TenantDomainRecord }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/domains/${encodeURIComponent(domainId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    })).domain;
}

export async function deletePlatformTenantDomain(tenantId: string, domainId: string) {
    await requestApiData<{ deleted: boolean }>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/domains/${encodeURIComponent(domainId)}`, { method: "DELETE" });
}
