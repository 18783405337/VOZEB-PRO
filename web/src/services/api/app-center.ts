import type { AppDefinition } from "@/lib/apps/app-definition";

import { requestApiData } from "./api-envelope";

export type TenantApplication = {
    id: string;
    appKey: string;
    version: string;
    status: "enabled" | "disabled";
    settings: Record<string, unknown>;
    pricing: {
        currency: string;
        saleUnit: string;
        saleAmount: number;
        collectionMode: "platform" | "tenant";
    } | null;
};

export type PublishedApplication = {
    appKey: string;
    version: string;
    definition: AppDefinition;
    publishedAt: number;
};

export type TenantApplicationCatalog = {
    available: PublishedApplication[];
    installed: TenantApplication[];
};

export type TenantLogicalApi = {
    logicalModelKey: string;
    name: string;
};

export type TenantApplicationProviderBinding = TenantLogicalApi & {
    status: "enabled";
};

export type TenantApplicationProviderBindingState = {
    binding: TenantApplicationProviderBinding | null;
    available: TenantLogicalApi[];
};

export type AdminApplication = {
    appKey: string;
    version: string;
    definition: AppDefinition;
    published: boolean;
    publishedAt: number | null;
};

export function listTenantApplications() {
    return requestApiData<TenantApplicationCatalog>("/api/tenant/apps", { cache: "no-store" });
}

export function getTenantApplication(appKey: string) {
    return requestApiData<TenantApplication>(`/api/tenant/apps/${encodeURIComponent(appKey)}`, { cache: "no-store" });
}

export async function installTenantApp(appKey: string, version: string) {
    return (await requestApiData<{ app: TenantApplication }>("/api/tenant/apps", {
        method: "POST",
        body: JSON.stringify({ appKey, version }),
    })).app;
}

export async function setTenantApplicationStatus(appKey: string, status: TenantApplication["status"]) {
    return (await requestApiData<{ app: TenantApplication }>(`/api/tenant/apps/${encodeURIComponent(appKey)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    })).app;
}

export function saveTenantApplicationSettings(appKey: string, input: { settings: Record<string, unknown>; secretRefs?: Record<string, string> }) {
    return requestApiData<{ saved: true }>(`/api/tenant/apps/${encodeURIComponent(appKey)}/settings`, {
        method: "PUT",
        body: JSON.stringify(input),
    });
}

export function saveTenantApplicationPricing(
    appKey: string,
    input: {
        currency: string;
        saleUnit: string;
        saleAmount: number;
        collectionMode: "platform" | "tenant";
    },
) {
    return requestApiData<{ saved: true }>(`/api/tenant/apps/${encodeURIComponent(appKey)}/pricing`, {
        method: "PUT",
        body: JSON.stringify(input),
    });
}

export function getTenantApplicationProviderBinding(appKey: string) {
    return requestApiData<TenantApplicationProviderBindingState>(providerBindingPath(appKey), { cache: "no-store" });
}

export function saveTenantApplicationProviderBinding(appKey: string, logicalModelKey: string) {
    return requestApiData<TenantApplicationProviderBindingState>(providerBindingPath(appKey), {
        method: "PUT",
        body: JSON.stringify({ logicalModelKey }),
    });
}

export function clearTenantApplicationProviderBinding(appKey: string) {
    return requestApiData<TenantApplicationProviderBindingState>(providerBindingPath(appKey), {
        method: "DELETE",
    });
}

export async function listAdminApplications() {
    return (await requestApiData<{ apps: AdminApplication[] }>("/api/admin/apps", { cache: "no-store" })).apps;
}

export async function publishApplicationVersion(appKey: string, version: string) {
    return (await requestApiData<{ app: PublishedApplication }>(`/api/admin/apps/${encodeURIComponent(appKey)}/versions`, {
        method: "POST",
        body: JSON.stringify({ version }),
    })).app;
}

function providerBindingPath(appKey: string) {
    return `/api/tenant/apps/${encodeURIComponent(appKey)}/provider-binding`;
}
