import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { readJsonBodyResult } from "@/lib/auth/request";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { requireTenantPermission } from "@/lib/server/authorization/authorization-service";
import { getBillingReconciliationRun, importBillingStatement, listBillingReconciliationRuns } from "@/lib/server/payment-reconciliation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const authorization = await requireTenantPermission(request, "tenant.billing.read");
        const url = new URL(request.url);
        const runId = url.searchParams.get("runId");
        if (runId) {
            const reconciliation = await getBillingReconciliationRun(runId, { tenantId: authorization.tenant.id });
            if (!reconciliation) return apiError(404, "对账批次不存在");
            return apiOk({ reconciliation });
        }
        const result = await listBillingReconciliationRuns(
            {
                page: url.searchParams.get("page") || undefined,
                pageSize: url.searchParams.get("pageSize") || undefined,
                provider: url.searchParams.get("provider") || undefined,
            },
            { tenantId: authorization.tenant.id },
        );
        return apiOk({ runs: result.items, total: result.total, page: result.page, pageSize: result.pageSize });
    } catch (error) {
        return apiError(error, "Failed to list tenant billing reconciliation runs", "tenant.billing.reconciliation.list");
    }
}

export async function POST(request: Request) {
    let authorization: Awaited<ReturnType<typeof requireTenantPermission>> | undefined;
    try {
        authorization = await requireTenantPermission(request, "tenant.billing.read");
        const parsed = await readJsonBodyResult<unknown>(request, 4 * 1024 * 1024);
        if (!parsed.ok) return apiError(parsed.status, parsed.message);
        if (!isRecord(parsed.data)) return apiError(400, "Request body must be a JSON object");

        const result = await importBillingStatement(
            {
                provider: parsed.data.provider,
                csvText: parsed.data.csvText,
                fileName: parsed.data.fileName,
                note: parsed.data.note,
            },
            { userId: authorization.user.id, username: authorization.user.username },
            { tenantId: authorization.tenant.id },
        );
        await safeRecordAuditLog({
            action: "tenant.billing.reconciliation.import",
            actor: auditActorFromRequest(request, authorization.user),
            target: { type: "billing_reconciliation", id: result.runId || result.provider },
            metadata: { tenantId: authorization.tenant.id, runId: result.runId, provider: result.provider, issueRows: result.issueRows },
        });
        return apiOk({ reconciliation: result }, 201);
    } catch (error) {
        if (authorization) {
            await safeRecordAuditLog({
                action: "tenant.billing.reconciliation.import",
                status: "failure",
                actor: auditActorFromRequest(request, authorization.user),
                target: { type: "billing_reconciliation" },
                metadata: { tenantId: authorization.tenant.id, error: error instanceof Error ? error.message : "unknown" },
            });
        }
        return apiError(error, "Failed to import tenant billing reconciliation statement", "tenant.billing.reconciliation.import");
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
