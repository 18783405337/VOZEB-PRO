import { apiError } from "@/app/api/_shared/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { AppCenterServiceError } from "@/lib/server/apps/app-center-service";
import { SpecializedProviderBindingError } from "@/lib/server/apps/specialized-provider-binding-service";
import { createPostgresRepositories, ensurePostgresSchema, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { getTrustedTenantId } from "@/lib/server/tenant/tenant-context";

import { ActionTransferInputError } from "./action-transfer-validation";

export async function requireActionTransferContext(request: Request) {
    if (!isPostgresDatabaseEnabled()) {
        throw new ActionTransferAccessError("动作迁移功能需要启用 PostgreSQL", 501);
    }

    const user = await getCurrentUser(request);
    if (!user) throw new ActionTransferAccessError("请先登录", 401);

    const tenantId = await getTrustedTenantId(request, user);
    await ensurePostgresSchema();
    return { user, tenantId, repository: createPostgresRepositories().actionTransfer };
}

export class ActionTransferAccessError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

export function actionTransferApiError(error: unknown, fallback: string, event: string) {
    if (error instanceof ActionTransferAccessError || error instanceof ActionTransferInputError) {
        return apiError(error.status, error.message);
    }
    if (error instanceof AppCenterServiceError) {
        const status = error.code === "APP_NOT_INSTALLED" ? 404 : error.code === "APP_DISABLED" ? 403 : 409;
        return apiError(status, error.message);
    }
    if (error instanceof SpecializedProviderBindingError) {
        return apiError(409, error.message);
    }
    return apiError(error, fallback, event);
}
