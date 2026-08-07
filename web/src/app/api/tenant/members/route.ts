import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.members.read");
        const members = await createPostgresRepositories().tenants.listMembers(authorization.tenant.id);
        return apiOk({ members });
    } catch (error) {
        return apiError(error, "Failed to list tenant members", "tenant.member.list");
    }
}

export async function POST(request: Request) {
    let failureAudit:
        | {
              action: string;
              actor: ReturnType<typeof auditActorFromRequest>;
              tenantId: string;
              userId: string;
              roleId: string;
              previousRoleId?: string;
          }
        | undefined;

    try {
        const authorization = await requireTenantPermission(request, "tenant.members.manage");
        const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "Request body must be a JSON object");

        const userId = textField(parsed.data.userId, 160);
        const roleId = textField(parsed.data.roleId, 160);
        if (!userId || !roleId) return apiError(400, "userId and roleId are required");

        const tenantId = authorization.tenant.id;
        const repositories = createPostgresRepositories();
        const role = await repositories.tenants.getRole(tenantId, roleId);
        if (!role) return apiError(404, "Tenant role was not found");

        const existingMember = await repositories.tenants.getMember(tenantId, userId);
        const action = existingMember ? "tenant.member.role.update" : "tenant.member.add";
        const actor = auditActorFromRequest(request, authorization.user);
        failureAudit = {
            action,
            actor,
            tenantId,
            userId,
            roleId,
            previousRoleId: existingMember?.roleId,
        };

        if (role.key === "owner") {
            await recordMemberWriteFailure(failureAudit, { reason: "owner_role_assignment_forbidden" });
            return apiError(403, "Owner role cannot be assigned through member management");
        }
        if (existingMember?.roleKey === "owner") {
            await recordMemberWriteFailure(failureAudit, { reason: "owner_membership_change_forbidden" });
            return apiError(403, "Owner membership cannot be changed through member management");
        }

        const member = await repositories.tenants.addMember({
            tenantId,
            userId,
            roleId,
            status: "active",
        });
        await safeRecordAuditLog({
            action,
            actor,
            target: { type: "tenant_member", id: userId },
            metadata: {
                tenantId,
                roleId,
                ...(existingMember ? { previousRoleId: existingMember.roleId } : {}),
            },
        });
        return apiOk({ member }, 201);
    } catch (error) {
        if (failureAudit) {
            await recordMemberWriteFailure(failureAudit, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return apiError(error, "Failed to add tenant member", "tenant.member.add");
    }
}

async function recordMemberWriteFailure(
    audit: {
        action: string;
        actor: ReturnType<typeof auditActorFromRequest>;
        tenantId: string;
        userId: string;
        roleId: string;
        previousRoleId?: string;
    },
    metadata: Record<string, unknown>,
) {
    await safeRecordAuditLog({
        action: audit.action,
        status: "failure",
        actor: audit.actor,
        target: { type: "tenant_member", id: audit.userId },
        metadata: {
            tenantId: audit.tenantId,
            roleId: audit.roleId,
            ...(audit.previousRoleId ? { previousRoleId: audit.previousRoleId } : {}),
            ...metadata,
        },
    });
}

function textField(value: unknown, maxLength: number) {
    if (typeof value !== "string") return "";
    const text = value.trim();
    return text.length <= maxLength ? text : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
