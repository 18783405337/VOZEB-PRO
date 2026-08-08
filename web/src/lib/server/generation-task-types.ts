import type { GenerationTaskExecutionPhase } from "@/lib/server/generation-task-scheduler";

export type GenerationTaskType = "text" | "image" | "video" | "audio" | "agent" | "render";
export type GenerationTaskStatus = "pending" | "running" | "success" | "error" | "paused" | "cancelled";

export type GenerationTaskContext = {
    tenantId?: string;
    appKey?: string;
    appVersion?: string;
    workflowKey?: string;
    conversationId?: string;
    runId?: string;
    surface?: "chat" | "canvas" | "drama";
    projectId?: string;
    episodeId?: string;
    shotId?: string;
    estimatedPoints?: number;
    parentTaskId?: string;
    attemptNo?: number;
    clientRequestId?: string;
    generationLogId?: string;
    generationSlotId?: string;
};

export type StoredGenerationTaskRecord = {
    id: string;
    tenantId: string;
    userId: string;
    type: GenerationTaskType;
    status: GenerationTaskStatus;
    payload: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
    executionPhase?: GenerationTaskExecutionPhase;
    upstreamTaskId?: string;
    channelId?: string;
    provider?: string;
    queryPath?: string;
    submittedAt?: number;
    nextPollAt?: number;
    lastPollAt?: number;
    lastUpstreamStatus?: string;
    resultPayload?: Record<string, unknown>;
    workerId?: string;
    leaseUntil?: number;
    lastHeartbeatAt?: number;
} & GenerationTaskContext;

export type GenerationTaskRecordListOptions = {
    page?: number;
    pageSize?: number;
    type?: string;
    status?: string;
    surface?: string;
    projectId?: string;
    userId?: string;
    tenantId?: string;
    search?: string;
    searchUserIds?: string[];
    includeAll?: boolean;
    includeAllTenants?: boolean;
};

export type GenerationTaskRecordSummary = {
    total: number;
    active: number;
    success: number;
    failed: number;
    averageDurationMs: number;
    totalPointsCost: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
};

export type GenerationTaskCostAggregate = {
    type: GenerationTaskType;
    status: GenerationTaskStatus;
    taskCount: number;
    estimatedPoints: number;
    actualPoints: number;
};

export type GenerationTaskExecutionState = Pick<StoredGenerationTaskRecord, "executionPhase" | "lastUpstreamStatus">;
