import type { TenantContextSource } from "@/lib/server/tenant/tenant-context";
import type { TenantDomainRecord, TenantMemberRecord, TenantRecord, TenantRoleRecord } from "@/lib/server/tenant/tenant-types";

import { requestApiData } from "./api-envelope";

export type TenantContextResponse = {
    tenant: TenantRecord;
    member: TenantMemberRecord;
    source: TenantContextSource;
};

export function getTenantAdminContext() {
    return requestApiData<TenantContextResponse>("/api/tenant/context", { cache: "no-store" });
}

export async function listTenantMembers() {
    return (await requestApiData<{ members: TenantMemberRecord[] }>("/api/tenant/members", { cache: "no-store" })).members;
}

export async function listTenantRoles() {
    return (await requestApiData<{ roles: TenantRoleRecord[] }>("/api/tenant/roles", { cache: "no-store" })).roles;
}

export async function listTenantDomains() {
    return (await requestApiData<{ domains: TenantDomainRecord[] }>("/api/tenant/domains", { cache: "no-store" })).domains;
}

export async function createTenantDomain(input: { hostname: string; kind?: "custom" | "subdomain" }) {
    return (await requestApiData<{ domain: TenantDomainRecord }>("/api/tenant/domains", { method: "POST", body: JSON.stringify(input) })).domain;
}

export async function updateTenantDomain(domainId: string, status: "pending" | "verified" | "disabled") {
    return (await requestApiData<{ domain: TenantDomainRecord }>(`/api/tenant/domains/${encodeURIComponent(domainId)}`, { method: "PATCH", body: JSON.stringify({ status }) })).domain;
}

export async function deleteTenantDomain(domainId: string) {
    return requestApiData<{ deleted: boolean }>(`/api/tenant/domains/${encodeURIComponent(domainId)}`, { method: "DELETE" });
}

export async function addTenantMember(input: { userId: string; roleId: string }) {
    return (await requestApiData<{ member: TenantMemberRecord }>("/api/tenant/members", { method: "POST", body: JSON.stringify(input) })).member;
}

export async function createTenantRole(input: { key: string; name: string; permissions: string[] }) {
    return (await requestApiData<{ role: TenantRoleRecord }>("/api/tenant/roles", { method: "POST", body: JSON.stringify(input) })).role;
}
