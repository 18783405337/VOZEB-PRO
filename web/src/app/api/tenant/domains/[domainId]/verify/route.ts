import { resolveTxt } from "node:dns/promises";

import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ domainId: string }> }) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.domains.manage");
        const { domainId } = await context.params;
        const repository = createPostgresRepositories().tenants;
        const domain = (await repository.listDomains(authorization.tenant.id)).find((item) => item.id === domainId);
        if (!domain) return apiError(404, "域名不存在");
        if (domain.status === "disabled") return apiError(409, "请先启用域名再验证");
        const recordName = `_vozeb-verification.${domain.hostname}`;
        let values: string[] = [];
        try { values = (await resolveTxt(recordName)).flat().map((value) => value.trim()); } catch { return apiError(400, `未找到 DNS TXT 记录：${recordName}`); }
        if (!values.includes(domain.verificationToken)) return apiError(400, "DNS TXT 验证值不匹配");
        const verified = await repository.verifyDomainForTenant(domain.id, authorization.tenant.id);
        if (!verified) return apiError(404, "域名不存在");
        await safeRecordAuditLog({ action: "tenant.domain.verify", actor: auditActorFromRequest(request, authorization.user), target: { type: "tenant_domain", id: verified.id, label: verified.hostname }, metadata: { tenantId: verified.tenantId, recordName } });
        return apiOk({ domain: verified });
    } catch (error) {
        return apiError(error, "验证租户域名失败", "tenant.domain.verify");
    }
}
