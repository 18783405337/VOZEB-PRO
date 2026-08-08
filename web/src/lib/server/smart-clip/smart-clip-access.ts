import { apiError } from "@/app/api/_shared/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { createPostgresRepositories, ensurePostgresSchema, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { getTrustedTenantId } from "@/lib/server/tenant/tenant-context";
import { isSmartClipEnabled } from "@/lib/server/tenant/saas-feature";
import { SmartClipInputError } from "./smart-clip-validation";

export async function requireSmartClipContext(request: Request) {
    if (!isSmartClipEnabled()) throw new SmartClipAccessError("Smart clip is disabled", 501);
    if (!isPostgresDatabaseEnabled()) throw new SmartClipAccessError("Smart clip requires PostgreSQL", 501);

    const user = await getCurrentUser(request);
    if (!user) throw new SmartClipAccessError("Please log in first", 401);

    const tenantId = await getTrustedTenantId(request, user);
    await ensurePostgresSchema();
    return { user, tenantId, repository: createPostgresRepositories().smartClip };
}

export class SmartClipAccessError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

export function smartClipApiError(error: unknown, fallback: string, event: string) {
    if (error instanceof SmartClipAccessError || error instanceof SmartClipInputError) {
        return apiError(error.status, error.message);
    }
    if (error instanceof Error && error.message.includes("not available")) {
        return apiError(404, error.message);
    }
    return apiError(error, fallback, event);
}
