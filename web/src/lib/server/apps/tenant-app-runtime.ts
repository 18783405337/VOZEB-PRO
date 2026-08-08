import { AppCenterService, AppCenterServiceError } from "./app-center-service";
import type { TenantAppDetails } from "@/lib/server/database/app-center-repository";
import { createPostgresRepositories, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { createPostgresTaskBillingService, type TaskBillingService } from "@/lib/server/billing/task-billing-service";
import { isAppCenterEnabled } from "@/lib/server/tenant/saas-feature";

export type TenantAppRuntimeOutput = "image" | "video" | "asset-set";
export type AppTaskBillingPort = Pick<TaskBillingService, "reserve" | "settle" | "release" | "reverse">;

export async function requireTenantAppRuntime(tenantId: string, appKey: string, output: TenantAppRuntimeOutput): Promise<TenantAppDetails> {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) {
        throw new AppCenterServiceError("Application center requires PostgreSQL", "APP_CENTER_UNAVAILABLE");
    }

    const service = new AppCenterService(createPostgresRepositories().appCenter);
    const tenantApp = await service.requireEnabledTenantApp(tenantId, appKey);
    if (tenantApp.definition.outputSchema.kind !== output) {
        throw new AppCenterServiceError("Application output does not match the requested runtime", "APP_OUTPUT_MISMATCH");
    }
    return tenantApp;
}

export function createTenantAppTaskBillingPort(): AppTaskBillingPort {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) {
        throw new AppCenterServiceError("Application task billing requires PostgreSQL", "APP_CENTER_UNAVAILABLE");
    }
    return createPostgresTaskBillingService();
}
