import { apiError } from "@/app/api/_shared/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { createPostgresRepositories, ensurePostgresSchema, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { AppCenterServiceError } from "@/lib/server/apps/app-center-service";
import { SpecializedProviderBindingError } from "@/lib/server/apps/specialized-provider-binding-service";
import { getTrustedTenantId } from "@/lib/server/tenant/tenant-context";

import { ImageHumanInputError } from "./image-human-validation";

export async function requireImageHumanContext(request: Request) {
    if (!isPostgresDatabaseEnabled()) throw new ImageHumanAccessError("图片数字人功能需要启用 PostgreSQL", 501);

    const user = await getCurrentUser(request);
    if (!user) throw new ImageHumanAccessError("请先登录", 401);

    const tenantId = await getTrustedTenantId(request, user);
    await ensurePostgresSchema();
    return { user, tenantId, repository: createPostgresRepositories().imageHuman };
}

export class ImageHumanAccessError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

export function imageHumanApiError(error: unknown, fallback: string, event: string) {
    if (error instanceof ImageHumanAccessError || error instanceof ImageHumanInputError) {
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
