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
        if (!isRecord(parsed.data)) return apiError(400, "Request body must be a JSON object");

        const currency = textField(parsed.data.currency, 32);
        const saleUnit = textField(parsed.data.saleUnit, 64);
        const saleAmount = parsed.data.saleAmount;
        const collectionMode = parsed.data.collectionMode;
        if (!currency || !saleUnit || typeof saleAmount !== "number" || !Number.isSafeInteger(saleAmount) || (collectionMode !== "platform" && collectionMode !== "tenant")) {
            return apiError(400, "currency, saleUnit, saleAmount and collectionMode are required");
        }

        const { appKey } = await context.params;
        const service = new AppCenterService(createPostgresRepositories().appCenter);
        await service.saveTenantAppPricing(authorization.tenant.id, appKey, {
            currency,
            saleUnit,
            saleAmount,
            collectionMode,
            updatedBy: authorization.user.id,
        });
        return apiOk({ saved: true });
    } catch (error) {
        return appCenterError(error, "Failed to save tenant application pricing", "tenant.apps.pricing");
    }
}

function appCenterError(error: unknown, fallback: string, event: string) {
    if (error instanceof AppCenterServiceError) {
        return apiError(error.code === "APP_NOT_INSTALLED" ? 404 : 400, error.message);
    }
    return apiError(error, fallback, event);
}

function textField(value: unknown, maxLength: number) {
    if (typeof value !== "string") return "";
    const text = value.trim();
    return text.length <= maxLength ? text : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
