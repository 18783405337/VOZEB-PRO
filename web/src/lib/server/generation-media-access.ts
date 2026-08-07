import { systemGenerationChannelId } from "@/lib/server/generation-channel";
import { readGenerationMediaClaim } from "@/lib/server/generation-media-authorization";
import { getStoredGenerationTaskRecord } from "@/lib/server/generation-task-store";
import { getTrustedTenantId } from "@/lib/server/tenant/tenant-context";

export async function authorizeGenerationMediaProxyRequest(request: Request, input: { tenantId?: string; userId: string; channelId: string; url: string }) {
    const tenantId = input.tenantId || await getTrustedTenantId(request, { id: input.userId }).catch(() => "");
    if (!tenantId) return false;
    const claim = readGenerationMediaClaim(request, { ...input, tenantId });
    if (!claim) return false;
    const record = await getStoredGenerationTaskRecord(claim.taskType, claim.taskId, tenantId);
    if (!record || record.tenantId !== tenantId || record.userId !== input.userId || record.status === "cancelled") return false;
    const config = objectValue(record.payload.config);
    const taskChannelId = record.channelId || String(config.channelId || "") || systemGenerationChannelId(String(config.baseUrl || ""));
    return taskChannelId === input.channelId && sameModel(String(config.model || ""), claim.upstreamModel);
}

function objectValue(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sameModel(left: string, right: string) {
    return normalizeModel(left) === normalizeModel(right);
}

function normalizeModel(value: string) {
    return value
        .trim()
        .replace(/^models\//i, "")
        .toLowerCase();
}
