import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { AppCenterService, AppCenterServiceError } from "@/lib/server/apps/app-center-service";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories, isPostgresDatabaseEnabled } from "@/lib/server/database";
import type { TenantApp, TenantAppDetails } from "@/lib/server/database/app-center-repository";
import { isAppCenterEnabled } from "@/lib/server/tenant/saas-feature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ appKey: string }> }) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.apps.read");
        const { appKey } = await context.params;
        const app = await createPostgresRepositories().appCenter.getTenantApp(authorization.tenant.id, appKey);
        if (!app) return apiError(404, "Application is not installed for this tenant");
        return apiOk(publicTenantApp(app));
    } catch (error) {
        return apiError(error, "Failed to get tenant application", "tenant.apps.detail");
    }
}

export async function PATCH(request: Request, context: { params: Promise<{ appKey: string }> }) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.apps.configure");
        const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "Request body must be a JSON object");

        const status = parsed.data.status;
        if (status !== "enabled" && status !== "disabled") return apiError(400, "status must be enabled or disabled");

        const { appKey } = await context.params;
        const service = new AppCenterService(createPostgresRepositories().appCenter);
        const app = await service.setTenantAppStatus(authorization.tenant.id, appKey, status);
        return apiOk(publicTenantApp(app));
    } catch (error) {
        return appCenterError(error, "Failed to update tenant application", "tenant.apps.status");
    }
}

function publicTenantApp(item: TenantApp | TenantAppDetails) {
    return {
        id: item.id,
        appKey: item.appKey,
        version: item.version,
        status: item.status,
        settings: "settings" in item ? item.settings : {},
        pricing: "pricing" in item ? item.pricing : null,
    };
}

function appCenterError(error: unknown, fallback: string, event: string) {
    if (error instanceof AppCenterServiceError) {
        return apiError(error.code === "APP_NOT_INSTALLED" ? 404 : 400, error.message);
    }
    return apiError(error, fallback, event);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
