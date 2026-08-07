import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { TENANT_PERMISSIONS } from "@/lib/server/authorization/permission-catalog";
import { createPostgresRepositories } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PERMISSIONS = new Set<string>(TENANT_PERMISSIONS);
const RESERVED_ROLE_KEYS = new Set(["owner"]);

export async function GET(request: Request) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.roles.manage");
        const roles = await createPostgresRepositories().tenants.listRoles(authorization.tenant.id);
        return apiOk({ roles });
    } catch (error) {
        return apiError(error, "Failed to list tenant roles", "tenant.role.list");
    }
}

export async function POST(request: Request) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.roles.manage");
        const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "Request body must be a JSON object");

        const key = typeof parsed.data.key === "string" ? parsed.data.key.trim().toLowerCase() : "";
        const name = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";
        if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(key) || RESERVED_ROLE_KEYS.has(key)) return apiError(400, "Tenant role key is invalid or reserved");
        if (!name || name.length > 120) return apiError(400, "Tenant role name is invalid");
        if (!Array.isArray(parsed.data.permissions) || !parsed.data.permissions.every((permission) => typeof permission === "string")) {
            return apiError(400, "Tenant role permissions must be a string array");
        }

        const permissions = [...new Set(parsed.data.permissions.map((permission) => permission.trim()))];
        if (permissions.some((permission) => !ALLOWED_PERMISSIONS.has(permission))) return apiError(400, "Tenant role contains an unsupported permission");

        const tenantId = authorization.tenant.id;
        const role = await createPostgresRepositories().tenants.createRole({
            tenantId,
            key,
            name,
            permissions,
        });
        await safeRecordAuditLog({
            action: "tenant.role.create",
            actor: auditActorFromRequest(request, authorization.user),
            target: { type: "tenant_role", id: role.id, label: role.name },
            metadata: { tenantId, key: role.key, permissions },
        });
        return apiOk({ role }, 201);
    } catch (error) {
        return apiError(error, "Failed to create tenant role", "tenant.role.create");
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
