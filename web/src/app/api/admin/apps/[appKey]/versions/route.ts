import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { AppCenterService, AppCenterServiceError } from "@/lib/server/apps/app-center-service";
import { requirePlatformPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { isAppCenterEnabled } from "@/lib/server/tenant/saas-feature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ appKey: string }> }) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        await requirePlatformPermission(request, "platform.apps.publish");
        const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "Request body must be a JSON object");

        const appKey = (await context.params).appKey;
        const version = textField(parsed.data.version, 32);
        if (!appKey || !version) return apiError(400, "Application key and version are required");

        const service = new AppCenterService(createPostgresRepositories().appCenter);
        const published = await service.publishAppVersion({ appKey, version });
        return apiOk({ app: published }, 201);
    } catch (error) {
        return appCenterError(error, "Failed to publish application", "platform.apps.publish");
    }
}

function appCenterError(error: unknown, fallback: string, event: string) {
    if (error instanceof AppCenterServiceError) {
        const status = error.code === "APP_NOT_FOUND" ? 404 : error.code === "APP_DEFINITION_MISMATCH" ? 409 : 400;
        return apiError(status, error.message);
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
