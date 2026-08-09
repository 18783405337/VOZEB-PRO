import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.domains.read");
        const domains = await createPostgresRepositories().tenants.listDomains(authorization.tenant.id);
        return apiOk({ domains });
    } catch (error) {
        return apiError(error, "获取租户域名失败", "tenant.domain.list");
    }
}

export async function POST(request: Request) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.domains.manage");
        const parsed = await readJsonBodyResult<unknown>(request, 32 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "请求内容必须是 JSON 对象");
        const hostname = textField(parsed.data.hostname, 253);
        if (!hostname) return apiError(400, "域名不能为空");
        const kind = parsed.data.kind === "subdomain" ? "subdomain" : "custom";
        const domain = await createPostgresRepositories().tenants.createDomain({ tenantId: authorization.tenant.id, hostname, kind });
        await safeRecordAuditLog({ action: "tenant.domain.create", actor: auditActorFromRequest(request, authorization.user), target: { type: "tenant_domain", id: domain.id, label: domain.hostname }, metadata: { tenantId: authorization.tenant.id, kind: domain.kind } });
        return apiOk({ domain }, 201);
    } catch (error) {
        return apiError(error, "创建租户域名失败", "tenant.domain.create");
    }
}

function textField(value: unknown, maxLength: number) {
    if (typeof value !== "string") return "";
    const text = value.trim();
    return text.length <= maxLength ? text : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
