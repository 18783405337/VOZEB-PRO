import { randomUUID } from "node:crypto";

import { createStoredGenerationTask, getStoredGenerationTask, touchStoredGenerationTask, transitionStoredGenerationTask, type GenerationTaskContext } from "./generation-task-store";

const TTL_MS = 24 * 60 * 60 * 1000;
const TASK_STALE_MS = 60 * 60 * 1000;
type DramaRenderStatus = "pending" | "running" | "success" | "error" | "cancelled";
export type DramaRenderTask = GenerationTaskContext & {
    id: string;
    userId: string;
    status: DramaRenderStatus;
    projectId: string;
    conversationId?: string;
    surface: "drama";
    title: string;
    result?: { url: string; mimeType: string };
    error?: string;
    createdAt: number;
    updatedAt: number;
};

export async function createDramaRenderTask(input: Pick<DramaRenderTask, "tenantId" | "userId" | "projectId" | "conversationId" | "title">) {
    const now = Date.now();
    const task: DramaRenderTask = { ...input, surface: "drama", id: randomUUID(), status: "pending", createdAt: now, updatedAt: now };
    return createStoredGenerationTask("render", task, TTL_MS);
}
export async function getDramaRenderTask(id: string, tenantId?: string) {
    const task = await getStoredGenerationTask<DramaRenderTask>("render", id, tenantId);
    if (!task || !isStale(task)) return task;
    return (await transitionDramaRenderTask(task, ["running"], { status: "error", error: "合成任务长时间未更新，已自动中止。" })) || getStoredGenerationTask<DramaRenderTask>("render", id, tenantId);
}
export function transitionDramaRenderTask(task: DramaRenderTask, allowedStatuses: DramaRenderStatus[], patch: Partial<Pick<DramaRenderTask, "result" | "error">> & { status: DramaRenderStatus }) {
    return transitionStoredGenerationTask<DramaRenderTask>("render", task.id, task.userId, allowedStatuses, patch, TTL_MS, undefined, task.tenantId);
}

export function touchDramaRenderTask(id: string, tenantId?: string) {
    return touchStoredGenerationTask("render", id, Date.now(), TTL_MS, tenantId);
}

function isStale(task: DramaRenderTask) {
    return task.status === "running" && task.updatedAt < Date.now() - TASK_STALE_MS;
}
