import type { TenantBillingOverview } from "@/lib/server/tenant-billing-admin-service";

import { requestApiData } from "./api-envelope";

export type { TenantBillingOverview };

export async function getTenantBillingOverview() {
    return (await requestApiData<{ overview: TenantBillingOverview }>("/api/tenant/billing/overview", { cache: "no-store" })).overview;
}
