import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { BillingInputError } from "@/lib/server/billing-errors";
import { createPostgresRepositories, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { MerchantAccountService, type SaveMerchantAccountInput } from "@/lib/server/payment/merchant-account-service";
import { isSaasEnabled } from "@/lib/server/tenant/saas-feature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    if (!isSaasEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Merchant account management requires SaaS PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.merchants.manage");
        const scope = tenantScope(authorization.tenant.id);
        const service = new MerchantAccountService(createPostgresRepositories().merchantAccounts);
        return apiOk({ accounts: await service.list(scope) });
    } catch (error) {
        return merchantAccountError(error, "Failed to list tenant merchant accounts", "tenant.billing.merchant_accounts.list");
    }
}

export async function PUT(request: Request) {
    if (!isSaasEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Merchant account management requires SaaS PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.merchants.manage");
        const parsed = await readJsonBodyResult<unknown>(request, 64 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        const input = parseSaveInput(parsed.data);
        if (!input) return apiError(400, "provider, environment, credentials and webhookIdentity are required");

        const service = new MerchantAccountService(createPostgresRepositories().merchantAccounts);
        return apiOk({ account: await service.save(tenantScope(authorization.tenant.id), input) });
    } catch (error) {
        return merchantAccountError(error, "Failed to save tenant merchant account", "tenant.billing.merchant_accounts.save");
    }
}

export async function DELETE(request: Request) {
    if (!isSaasEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Merchant account management requires SaaS PostgreSQL");

    try {
        const authorization = await requireTenantPermission(request, "tenant.merchants.manage");
        const id = new URL(request.url).searchParams.get("id")?.trim();
        if (!id) return apiError(400, "Merchant account id is required");

        const service = new MerchantAccountService(createPostgresRepositories().merchantAccounts);
        return apiOk({ account: await service.disable(tenantScope(authorization.tenant.id), id) });
    } catch (error) {
        return merchantAccountError(error, "Failed to disable tenant merchant account", "tenant.billing.merchant_accounts.disable");
    }
}

function tenantScope(tenantId: string) {
    return { ownerType: "tenant" as const, ownerId: tenantId, tenantId };
}

function parseSaveInput(value: unknown): SaveMerchantAccountInput | null {
    if (!isRecord(value)) return null;
    const provider = textField(value.provider, 80);
    const environment = value.environment === "test" || value.environment === "production" ? value.environment : undefined;
    const webhookIdentity = textField(value.webhookIdentity, 200);
    if (!provider || !environment || !webhookIdentity || !isRecord(value.credentials)) return null;

    const credentials: Record<string, string> = {};
    for (const [key, item] of Object.entries(value.credentials)) {
        if (typeof item !== "string") return null;
        credentials[key] = item;
    }
    return { provider, environment, credentials, webhookIdentity };
}

function merchantAccountError(error: unknown, fallback: string, event: string) {
    if (error instanceof BillingInputError) return apiError(error.status, error.message);
    return apiError(error, fallback, event);
}

function textField(value: unknown, maxLength: number) {
    if (typeof value !== "string") return "";
    const text = value.trim();
    return text && text.length <= maxLength ? text : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
