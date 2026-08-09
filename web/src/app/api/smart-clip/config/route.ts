import { apiOk } from "@/app/api/_shared/api-response";
import { requireSmartClipContext, smartClipApiError } from "@/lib/server/smart-clip/smart-clip-access";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { tenantId, repository } = await requireSmartClipContext(request);
        const config = await repository.getConfig(tenantId);
        return apiOk({ config, templates: repository.listTemplates() });
    } catch (error) {
        return smartClipApiError(error, "Failed to load smart clip config", "smart-clip.config");
    }
}

export async function PATCH(request: Request) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.settings.manage");
        const body = await request.json() as Record<string, unknown>;
        const config = await createPostgresRepositories().smartClip.updateConfig(authorization.tenant.id, {
            provider: typeof body.provider === "string" ? body.provider : "mock",
            model: typeof body.model === "string" ? body.model : "smart-clip",
            enabled: body.enabled === true,
            config: body.config && typeof body.config === "object" && !Array.isArray(body.config) ? body.config as Record<string, unknown> : {},
        });
        return apiOk({ config });
    } catch (error) {
        return smartClipApiError(error, "Failed to update smart clip config", "smart-clip.config.update");
    }
}
