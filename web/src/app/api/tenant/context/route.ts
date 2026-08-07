import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { requireTenantMembership } from "@/lib/server/authorization/authorization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { tenant, member, source } = await requireTenantMembership(request);
        return apiOk({ tenant, member, source });
    } catch (error) {
        return apiError(error, "Failed to get tenant context", "tenant.context.get");
    }
}
