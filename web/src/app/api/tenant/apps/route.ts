import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { AppCenterService, AppCenterServiceError } from "@/lib/server/apps/app-center-service";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories, isPostgresDatabaseEnabled } from "@/lib/server/database";
import type { PublishedAppVersion, TenantAppDetails } from "@/lib/server/database/app-center-repository";
import { isAppCenterEnabled } from "@/lib/server/tenant/saas-feature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.apps.read");
        const repositories = createPostgresRepositories();
        const [published, installed] = await Promise.all([repositories.appCenter.listPublished(), repositories.appCenter.listTenantApps(authorization.tenant.id)]);
        return apiOk({
            available: published.map(publicPublished),
            installed: installed.map(publicTenantApp),
        });
    } catch (error) {
        return apiError(error, "Failed to list tenant applications", "tenant.apps.list");
    }
}

export async function POST(request: Request) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.apps.configure");
        const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "Request body must be a JSON object");

        const appKey = textField(parsed.data.appKey, 120);
        const version = textField(parsed.data.version, 32);
        if (!appKey || !version) return apiError(400, "appKey and version are required");

        const service = new AppCenterService(createPostgresRepositories().appCenter);
        const installed = await service.installTenantApp(authorization.tenant.id, {
            appKey,
            version,
            installedBy: authorization.user.id,
        });
        return apiOk({ app: installed }, 201);
    } catch (error) {
        return appCenterError(error, "Failed to install tenant application", "tenant.apps.install");
    }
}

function publicPublished(item: PublishedAppVersion) {
    return { appKey: item.appKey, version: item.version, definition: item.definition, publishedAt: item.publishedAt };
}

function publicTenantApp(item: TenantAppDetails) {
    return {
        id: item.id,
        appKey: item.appKey,
        version: item.version,
        status: item.status,
        settings: item.settings,
        pricing: item.pricing,
    };
}

function appCenterError(error: unknown, fallback: string, event: string) {
    if (error instanceof AppCenterServiceError) {
        const status = error.code === "APP_NOT_FOUND" || error.code === "APP_NOT_INSTALLED" ? 404 : error.code === "APP_NOT_PUBLISHED" ? 409 : 400;
        return apiError(status, error.message);
    }
    if (error instanceof Error && error.message.includes("already installed")) return apiError(409, error.message);
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
