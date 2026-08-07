import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContext } from "@/lib/server/tenant/tenant-context";

import type { PlatformPermission, TenantPermission } from "./permission-catalog";

export type AuthorizationErrorCode = "auth.required" | "platform.permission_denied" | "tenant.permission_denied";

export class AuthorizationError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code: AuthorizationErrorCode,
    ) {
        super(message);
        this.name = "AuthorizationError";
    }
}

export async function requirePlatformPermission(request: Request, permission: PlatformPermission) {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthorizationError("请先登录", 401, "auth.required");
    if (user.role !== "admin") throw new AuthorizationError("需要平台管理员权限", 403, "platform.permission_denied");
    return { user, permission };
}

export async function requireTenantPermission(request: Request, permission: TenantPermission) {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthorizationError("请先登录", 401, "auth.required");

    const context = await getTenantContext(request, { user, requireMembership: true });
    const member = context.member;
    const allowed = member?.status === "active" && (member.roleKey === "owner" || member.permissions.includes(permission));
    if (!allowed) throw new AuthorizationError("租户权限不足", 403, "tenant.permission_denied");

    return { user, ...context, permission };
}
