import { requestApiData } from "./api-envelope";

export type TenantSettings = {
    title?: string;
    logoUrl?: string;
    iconUrl?: string;
    phone?: string;
    notes?: string;
    allowCustomStorage?: boolean;
    allowLocalStorage?: boolean;
    siteUrl?: string;
};

export function getTenantSettings() {
    return requestApiData<{ settings: TenantSettings }>("/api/tenant/settings", { cache: "no-store" });
}

export function updateTenantSettings(settings: TenantSettings) {
    return requestApiData<{ settings: TenantSettings }>("/api/tenant/settings", { method: "PATCH", body: JSON.stringify(settings) });
}
