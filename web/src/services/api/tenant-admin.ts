import type { TenantContextSource } from "@/lib/server/tenant/tenant-context";
import type { TenantMemberRecord, TenantRecord, TenantRoleRecord } from "@/lib/server/tenant/tenant-types";

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

export async function addTenantMember(input: { userId: string; roleId: string }) {
    return (await requestApiData<{ member: TenantMemberRecord }>("/api/tenant/members", {
        method: "POST",
        body: JSON.stringify(input),
    })).member;
}

export async function createTenantRole(input: { key: string; name: string; permissions: string[] }) {
    return (await requestApiData<{ role: TenantRoleRecord }>("/api/tenant/roles", {
        method: "POST",
        body: JSON.stringify(input),
    })).role;
}
