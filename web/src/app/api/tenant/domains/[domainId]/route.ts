import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ domainId: string }> }) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.domains.manage");
        const { domainId } = await context.params;
        const parsed = await readJsonBodyResult<unknown>(request, 16 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "请求内容必须是 JSON 对象");
        const status = parsed.data.status;
        if (status !== "disabled" && status !== "pending") return apiError(400, "域名状态只能设置为待验证或已停用");
        const domain = await createPostgresRepositories().tenants.updateDomainStatusForTenant(domainId, authorization.tenant.id, status);
        if (!domain) return apiError(404, "域名不存在");
        await safeRecordAuditLog({ action: "tenant.domain.status", actor: auditActorFromRequest(request, authorization.user), target: { type: "tenant_domain", id: domain.id, label: domain.hostname }, metadata: { tenantId: domain.tenantId, status: domain.status } });
        return apiOk({ domain });
    } catch (error) {
        return apiError(error, "更新租户域名状态失败", "tenant.domain.status");
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ domainId: string }> }) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.domains.manage");
        const { domainId } = await context.params;
        const repositories = createPostgresRepositories();
        const domain = (await repositories.tenants.listDomains(authorization.tenant.id)).find((item) => item.id === domainId);
        if (!domain) return apiError(404, "域名不存在");
        if (domain.status === "verified") return apiError(409, "已验证域名不能直接删除，请先停用");
        const deleted = await repositories.tenants.deleteDomainForTenant(domainId, authorization.tenant.id);
        if (!deleted) return apiError(404, "域名不存在");
        await safeRecordAuditLog({ action: "tenant.domain.delete", actor: auditActorFromRequest(request, authorization.user), target: { type: "tenant_domain", id: domain.id, label: domain.hostname }, metadata: { tenantId: authorization.tenant.id } });
        return apiOk({ deleted: true });
    } catch (error) {
        return apiError(error, "删除租户域名失败", "tenant.domain.delete");
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
