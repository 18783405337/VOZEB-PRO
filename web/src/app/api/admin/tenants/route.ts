import { getPublicUsersByIds } from "@/lib/auth/store";
import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requirePlatformPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories } from "@/lib/server/database";
import { isSaasEnabled } from "@/lib/server/tenant/saas-feature";
import type { TenantStatus } from "@/lib/server/tenant/tenant-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    if (!isSaasEnabled()) return apiError(501, "SaaS tenant administration is disabled");

    try {
        await requirePlatformPermission(request, "platform.tenants.read");
        const params = new URL(request.url).searchParams;
        const status = tenantStatus(params.get("status"));
        const result = await createPostgresRepositories().tenants.list({
            page: Number(params.get("page") || 1),
            pageSize: Number(params.get("pageSize") || 20),
            keyword: params.get("keyword")?.trim() || "",
            ...(status ? { status } : {}),
        });
        const ownerIds = result.items.map((item) => item.ownerUserId).filter((value): value is string => Boolean(value));
        const owners = new Map((await getPublicUsersByIds(ownerIds)).map((user) => [user.id, user]));
        return apiOk({
            ...result,
            items: result.items.map((item) => {
                const owner = item.ownerUserId ? owners.get(item.ownerUserId) : undefined;
                return {
                    ...item,
                    ...(owner ? {
                        ownerUsername: owner.username,
                        ownerDisplayName: owner.displayName,
                        ownerAccountId: owner.accountId,
                        ...(owner.avatarUrl ? { ownerAvatarUrl: owner.avatarUrl } : {}),
                    } : {}),
                };
            }),
        });
    } catch (error) {
        return apiError(error, "获取租户列表失败", "platform.tenant.list");
    }
}

export async function POST(request: Request) {
    if (!isSaasEnabled()) return apiError(501, "SaaS tenant administration is disabled");

    let user: { id: string; username?: string; role?: "admin" | "user" } | undefined;
    try {
        const authorization = await requirePlatformPermission(request, "platform.tenants.manage");
        user = authorization.user;
        const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "请求内容必须是 JSON 对象");
        const body = parsed.data;

        const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return apiError(400, "租户标识格式无效");
        if (!name || name.length > 120) return apiError(400, "租户名称格式无效");

        const ownerUserId = typeof body.ownerUserId === "string" && body.ownerUserId.trim() ? body.ownerUserId.trim() : "";
        if (!ownerUserId) return apiError(400, "请选择租户所有者");
        const repositories = createPostgresRepositories();
        const owner = await repositories.users.getById(ownerUserId);
        if (!owner || owner.status !== "active") return apiError(400, "租户所有者用户不存在或已禁用");
        const tenant = await repositories.tenants.createWithOwner({ slug, name, ownerUserId });
        await safeRecordAuditLog({
            action: "platform.tenant.create",
            actor: auditActorFromRequest(request, user),
            target: { type: "tenant", id: tenant.id, label: tenant.name },
            metadata: { slug: tenant.slug, ownerUserId },
        });
        return apiOk({ tenant }, 201);
    } catch (error) {
        if (user) {
            await safeRecordAuditLog({
                action: "platform.tenant.create",
                status: "failure",
                actor: auditActorFromRequest(request, user),
                target: { type: "tenant" },
                metadata: { error: error instanceof Error ? error.message : "unknown" },
            });
        }
        return apiError(error, "创建租户失败", "platform.tenant.create");
    }
}

function tenantStatus(value: string | null): TenantStatus | undefined {
    return value === "active" || value === "disabled" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
