import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { requirePlatformPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KEYS = new Set(["title", "logoUrl", "iconUrl", "phone", "notes", "allowCustomStorage", "allowLocalStorage", "siteUrl"]);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        await requirePlatformPermission(request, "platform.tenants.read");
        const { id } = await context.params;
        const tenant = await createPostgresRepositories().tenants.getById(id);
        if (!tenant) return apiError(404, "租户不存在");
        return apiOk({ settings: sanitize(tenant.settings) });
    } catch (error) {
        return apiError(error, "获取租户基础信息失败", "platform.tenant.settings.get");
    }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        await requirePlatformPermission(request, "platform.tenants.manage");
        const { id } = await context.params;
        const parsed = await readJsonBodyResult<unknown>(request, 32 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "请求内容必须是 JSON 对象");
        const repositories = createPostgresRepositories();
        const tenant = await repositories.tenants.getById(id);
        if (!tenant) return apiError(404, "租户不存在");
        const settings = await repositories.tenants.updateSettings(id, sanitize({ ...tenant.settings, ...parsed.data }));
        return apiOk({ settings: sanitize(settings) });
    } catch (error) {
        return apiError(error, "更新租户基础信息失败", "platform.tenant.settings.update");
    }
}

function sanitize(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value || {}).filter(([key]) => ALLOWED_KEYS.has(key)).map(([key, item]) => [key, typeof item === "string" ? item.trim().slice(0, 1000) : typeof item === "boolean" ? item : ""]));
}
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
