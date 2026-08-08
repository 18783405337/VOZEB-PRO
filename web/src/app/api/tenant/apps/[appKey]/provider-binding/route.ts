import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { AppCenterServiceError } from "@/lib/server/apps/app-center-service";
import { SpecializedProviderBindingError, SpecializedProviderBindingService } from "@/lib/server/apps/specialized-provider-binding-service";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { isAppCenterEnabled } from "@/lib/server/tenant/saas-feature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ appKey: string }> };

export async function GET(request: Request, context: RouteContext) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.apps.read");
        const { appKey } = await context.params;
        const service = providerBindingService();
        const [binding, available] = await Promise.all([
            service.getTenantAppProviderBinding(authorization.tenant.id, appKey),
            service.listTenantAppLogicalApis(authorization.tenant.id, appKey),
        ]);
        return apiOk({ binding, available });
    } catch (error) {
        return providerBindingError(error, "Failed to load tenant application provider binding", "tenant.apps.provider_binding.read");
    }
}

export async function PUT(request: Request, context: RouteContext) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.apps.configure");
        const parsed = await readJsonBodyResult<unknown>(request, 16 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data) || Object.keys(parsed.data).some((key) => key !== "logicalModelKey")) {
            return apiError(400, "Request body may only contain logicalModelKey");
        }

        const logicalModelKey = textField(parsed.data.logicalModelKey, 120);
        if (!logicalModelKey) return apiError(400, "logicalModelKey is required");

        const { appKey } = await context.params;
        const service = providerBindingService();
        const binding = await service.saveTenantAppProviderBinding(authorization.tenant.id, appKey, logicalModelKey, authorization.user.id);
        const available = await service.listTenantAppLogicalApis(authorization.tenant.id, appKey);
        return apiOk({ binding, available });
    } catch (error) {
        return providerBindingError(error, "Failed to save tenant application provider binding", "tenant.apps.provider_binding.save");
    }
}

export async function DELETE(request: Request, context: RouteContext) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.apps.configure");
        const { appKey } = await context.params;
        const service = providerBindingService();
        await service.clearTenantAppProviderBinding(authorization.tenant.id, appKey);
        const available = await service.listTenantAppLogicalApis(authorization.tenant.id, appKey);
        return apiOk({ binding: null, available });
    } catch (error) {
        return providerBindingError(error, "Failed to clear tenant application provider binding", "tenant.apps.provider_binding.clear");
    }
}

function providerBindingService() {
    return new SpecializedProviderBindingService(createPostgresRepositories().appCenter);
}

function providerBindingError(error: unknown, fallback: string, event: string) {
    if (error instanceof SpecializedProviderBindingError) {
        const status =
            error.code === "LOGICAL_API_NOT_FOUND"
                ? 404
                : error.code === "PROVIDER_NOT_BOUND" || error.code === "LOGICAL_API_DISABLED" || error.code === "LOGICAL_API_NOT_READY"
                  ? 409
                  : 400;
        return apiError(status, error.message);
    }
    if (error instanceof AppCenterServiceError) {
        const status = error.code === "APP_NOT_INSTALLED" ? 404 : error.code === "APP_DISABLED" ? 409 : 400;
        return apiError(status, error.message);
    }
    return apiError(error, fallback, event);
}

function textField(value: unknown, maxLength: number) {
    if (typeof value !== "string") return "";
    const text = value.trim();
    return text && text.length <= maxLength ? text : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
