import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requirePlatformPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        await requirePlatformPermission(request, "platform.tenants.domains.read");
        const { id } = await context.params;
        const domains = await createPostgresRepositories().tenants.listDomains(id);
        return apiOk({ domains });
    } catch (error) {
        return apiError(error, "获取租户域名失败", "platform.tenant.domain.list");
    }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const authorization = await requirePlatformPermission(request, "platform.tenants.domains.manage");
        const { id } = await context.params;
        const parsed = await readJsonBodyResult<unknown>(request, 32 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "请求内容必须是 JSON 对象");
        const hostname = typeof parsed.data.hostname === "string" ? parsed.data.hostname.trim() : "";
        if (!hostname || hostname.length > 253) return apiError(400, "域名格式无效");
        const kind = parsed.data.kind === "subdomain" ? "subdomain" : "custom";
        const domain = await createPostgresRepositories().tenants.createDomain({ tenantId: id, hostname, kind });
        await safeRecordAuditLog({ action: "platform.tenant.domain.create", actor: auditActorFromRequest(request, authorization.user), target: { type: "tenant_domain", id: domain.id, label: domain.hostname }, metadata: { tenantId: id, kind: domain.kind } });
        return apiOk({ domain }, 201);
    } catch (error) {
        return apiError(error, "创建租户域名失败", "platform.tenant.domain.create");
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
