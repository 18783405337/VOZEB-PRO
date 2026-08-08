import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { isPostgresDatabaseEnabled } from "@/lib/server/database";
import { getTenantBillingOverview } from "@/lib/server/tenant-billing-admin-service";
import { isSaasBillingEnabled } from "@/lib/server/tenant/saas-feature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    if (!isSaasBillingEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Tenant billing administration requires SaaS PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.billing.read");
        return apiOk({ overview: await getTenantBillingOverview(authorization.tenant.id) });
    } catch (error) {
        return apiError(error, "Failed to load tenant billing overview", "tenant.billing.overview");
    }
}
