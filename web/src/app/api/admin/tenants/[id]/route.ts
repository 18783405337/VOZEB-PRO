import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requirePlatformPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";
import type { TenantRecord, TenantStatus } from "@/lib/server/tenant/tenant-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    let user: { id: string; username?: string; role?: "admin" | "user" } | undefined;
    let attemptedStatusChange = false;
    try {
        const authorization = await requirePlatformPermission(request, "platform.tenants.manage");
        user = authorization.user;
        const { id } = await context.params;
        const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "请求内容必须是 JSON 对象");
        const body = parsed.data;

        const hasName = body.name !== undefined;
        const hasStatus = body.status !== undefined;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const status = tenantStatus(body.status);
        if (hasName && (!name || name.length > 120)) return apiError(400, "租户名称格式无效");
        if (hasStatus && !status) return apiError(400, "租户状态无效");
        if (!hasName && !hasStatus) return apiError(400, "没有可更新的租户字段");
        if (hasName && hasStatus) return apiError(400, "每次只能更新租户名称或状态");

        const repositories = createPostgresRepositories();
        const existing = await repositories.tenants.getById(id);
        if (!existing) return apiError(404, "租户不存在");

        let tenant: TenantRecord = existing;
        if (hasName) {
            const updated = await repositories.tenants.updateName(id, name);
            if (!updated) return apiError(404, "租户不存在");
            tenant = updated;
            await safeRecordAuditLog({
                action: "platform.tenant.update",
                actor: auditActorFromRequest(request, user),
                target: { type: "tenant", id, label: tenant.name },
                metadata: { name: tenant.name, previousName: existing.name },
            });
        }
        if (status) {
            attemptedStatusChange = true;
            const updated = await repositories.tenants.updateStatus(id, status);
            if (!updated) return apiError(404, "租户不存在");
            tenant = updated;
            await safeRecordAuditLog({
                action: "platform.tenant.status",
                actor: auditActorFromRequest(request, user),
                target: { type: "tenant", id, label: tenant.name },
                metadata: { status: tenant.status, previousStatus: existing.status },
            });
        }

        return apiOk({ tenant });
    } catch (error) {
        if (user) {
            const { id } = await context.params;
            await safeRecordAuditLog({
                action: attemptedStatusChange ? "platform.tenant.status" : "platform.tenant.update",
                status: "failure",
                actor: auditActorFromRequest(request, user),
                target: { type: "tenant", id },
                metadata: { error: error instanceof Error ? error.message : "unknown" },
            });
        }
        return apiError(error, "更新租户失败", "platform.tenant.update");
    }
}

function tenantStatus(value: unknown): TenantStatus | undefined {
    return value === "active" || value === "disabled" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
