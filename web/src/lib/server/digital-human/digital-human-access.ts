import { apiError } from "@/app/api/_shared/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { createPostgresRepositories, ensurePostgresSchema, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { getTrustedTenantId } from "@/lib/server/tenant/tenant-context";
import { isDigitalHumanEnabled } from "@/lib/server/tenant/saas-feature";
import { DigitalHumanInputError } from "./digital-human-validation";

export async function requireDigitalHumanContext(request: Request) {
    if (!isDigitalHumanEnabled()) throw new DigitalHumanAccessError("数字人功能未启用，请配置 VOZEB_PRO_DIGITAL_HUMAN_ENABLED", 501);
    if (!isPostgresDatabaseEnabled()) throw new DigitalHumanAccessError("数字人功能需要启用 PostgreSQL", 501);

    const user = await getCurrentUser(request);
    if (!user) throw new DigitalHumanAccessError("请先登录", 401);

    const tenantId = await getTrustedTenantId(request, user);
    await ensurePostgresSchema();
    return { user, tenantId, repository: createPostgresRepositories().digitalHuman };
}

export class DigitalHumanAccessError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

export function digitalHumanApiError(error: unknown, fallback: string, event: string) {
    if (error instanceof DigitalHumanAccessError || error instanceof DigitalHumanInputError) {
        return apiError(error.status, error.message);
    }
    if (error instanceof Error && error.message.includes("not available")) {
        return apiError(404, error.message);
    }
    return apiError(error, fallback, event);
}
