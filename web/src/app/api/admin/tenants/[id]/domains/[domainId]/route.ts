import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requirePlatformPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; domainId: string }> }) {
    try {
        const authorization = await requirePlatformPermission(request, "platform.tenants.domains.manage");
        const { id, domainId } = await context.params;
        const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
        const status = body?.status;
        if (status !== "disabled" && status !== "pending") return apiError(400, "域名状态只能设置为待验证或已停用");
        const domain = await createPostgresRepositories().tenants.updateDomainStatusForTenant(domainId, id, status);
        if (!domain) return apiError(404, "域名不存在");
        await safeRecordAuditLog({ action: "platform.tenant.domain.status", actor: auditActorFromRequest(request, authorization.user), target: { type: "tenant_domain", id: domain.id, label: domain.hostname }, metadata: { tenantId: id, status: domain.status } });
        return apiOk({ domain });
    } catch (error) {
        return apiError(error, "更新租户域名状态失败", "platform.tenant.domain.status");
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; domainId: string }> }) {
    try {
        const authorization = await requirePlatformPermission(request, "platform.tenants.domains.manage");
        const { id, domainId } = await context.params;
        const repositories = createPostgresRepositories();
        const domain = (await repositories.tenants.listDomains(id)).find((item) => item.id === domainId);
        if (!domain) return apiError(404, "域名不存在");
        if (domain.status === "verified") return apiError(409, "已验证域名不能直接删除，请先停用");
        if (!(await repositories.tenants.deleteDomainForTenant(domainId, id))) return apiError(404, "域名不存在");
        await safeRecordAuditLog({ action: "platform.tenant.domain.delete", actor: auditActorFromRequest(request, authorization.user), target: { type: "tenant_domain", id: domain.id, label: domain.hostname }, metadata: { tenantId: id } });
        return apiOk({ deleted: true });
    } catch (error) {
        return apiError(error, "删除租户域名失败", "platform.tenant.domain.delete");
    }
}
