import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KEYS = new Set(["title", "logoUrl", "iconUrl", "phone", "notes", "allowCustomStorage", "allowLocalStorage", "siteUrl"]);

export async function GET(request: Request) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.settings.read");
        const settings = await createPostgresRepositories().tenants.getSettings(authorization.tenant.id);
        return apiOk({ settings: sanitize(settings) });
    } catch (error) {
        return apiError(error, "获取租户配置失败", "tenant.settings.get");
    }
}

export async function PATCH(request: Request) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.settings.manage");
        const parsed = await readJsonBodyResult<unknown>(request, 32 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "请求内容必须是 JSON 对象");
        const current = await createPostgresRepositories().tenants.getSettings(authorization.tenant.id);
        const next = sanitize({ ...current, ...parsed.data });
        const settings = await createPostgresRepositories().tenants.updateSettings(authorization.tenant.id, next);
        await safeRecordAuditLog({ action: "tenant.settings.update", actor: auditActorFromRequest(request, authorization.user), target: { type: "tenant", id: authorization.tenant.id }, metadata: { fields: Object.keys(parsed.data) } });
        return apiOk({ settings: sanitize(settings) });
    } catch (error) {
        return apiError(error, "更新租户配置失败", "tenant.settings.update");
    }
}

function sanitize(value: Record<string, unknown>) {
    return Object.fromEntries([...Object.entries(value)].filter(([key]) => ALLOWED_KEYS.has(key)).map(([key, item]) => [key, typeof item === "string" ? item.trim().slice(0, 1000) : typeof item === "boolean" ? item : ""]));
}
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
