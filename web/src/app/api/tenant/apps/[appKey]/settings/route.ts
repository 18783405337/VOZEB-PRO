import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { AppCenterService, AppCenterServiceError } from "@/lib/server/apps/app-center-service";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { isAppCenterEnabled } from "@/lib/server/tenant/saas-feature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ appKey: string }> }) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.apps.configure");
        const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data) || !isRecord(parsed.data.settings)) {
            return apiError(400, "settings must be a JSON object");
        }

        const secretRefs = parsed.data.secretRefs === undefined ? {} : parsed.data.secretRefs;
        if (!isRecord(secretRefs)) return apiError(400, "secretRefs must be a JSON object");

        const { appKey } = await context.params;
        const service = new AppCenterService(createPostgresRepositories().appCenter);
        await service.saveTenantAppSettings(authorization.tenant.id, appKey, {
            settings: parsed.data.settings,
            secretRefs: stringRecord(secretRefs),
            updatedBy: authorization.user.id,
        });
        return apiOk({ saved: true });
    } catch (error) {
        return appCenterError(error, "Failed to save tenant application settings", "tenant.apps.settings");
    }
}

function appCenterError(error: unknown, fallback: string, event: string) {
    if (error instanceof AppCenterServiceError) {
        return apiError(error.code === "APP_NOT_INSTALLED" ? 404 : 400, error.message);
    }
    return apiError(error, fallback, event);
}

function stringRecord(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typeof entry === "string" ? entry : ""])) as Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

