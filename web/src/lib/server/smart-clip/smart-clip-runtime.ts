import { generationTaskNextPollAt } from "@/lib/server/generation-task-scheduler";
import { sanitizeSpecializedProviderMessage } from "@/lib/server/specialized-provider/provider-types";
import type { SmartClipProviderContext, SmartClipProviderRequest, SmartClipProviderResult } from "./xhadmin-smart-clip-provider";

export type SmartClipRuntimeTask = Readonly<{
    id: string; tenantId: string; userId: string; clipType: SmartClipProviderRequest["clipType"]; styleId: string; title: string; videoUri: string; audioUri: string; materials: unknown; introduceCard: unknown; packRules: unknown; processRules: unknown; structLayers: unknown; subtitle: unknown; language: string; provider: string; model: string; providerTaskId: string; providerPayload: Record<string, unknown>; status: "pending" | "running" | "success" | "error" | "cancelled"; progress: number;
}>;

type RuntimeProvider = Readonly<{ submit(request: SmartClipProviderRequest, context: SmartClipProviderContext): Promise<SmartClipProviderResult>; query(taskId: string, context: SmartClipProviderContext): Promise<SmartClipProviderResult> }>;

type RuntimeInput = Readonly<{ config: SmartClipProviderContext; provider: RuntimeProvider; saveTask: (patch: Record<string, unknown>) => Promise<void> | void; persistResult?: (url: string) => Promise<string>; completeTask?: (url: string, payload: Record<string, unknown>) => Promise<void>; failTask?: (message: string, payload: Record<string, unknown>) => Promise<void>; now?: number }>;

export async function runSmartClipTaskStep(task: SmartClipRuntimeTask, input: RuntimeInput) {
    const now = input.now ?? Date.now();
    try {
        if (!task.providerTaskId) {
            const submission = await input.provider.submit(toRequest(task), input.config);
            await input.saveTask({ providerTaskId: submission.taskId, providerPayload: { ...task.providerPayload, submission: submission.payload }, status: "running", progress: 15, error: "", nextPollAt: generationTaskNextPollAt({ now }) });
            return { state: "pending" as const, providerTaskId: submission.taskId, nextPollAt: generationTaskNextPollAt({ now }) };
        }
        const result = await input.provider.query(task.providerTaskId, input.config);
        const payload = { ...task.providerPayload, queryResult: result.payload };
        if (result.state === "failed" || result.state === "cancelled") {
            const message = sanitizeSpecializedProviderMessage(result.error || `Provider task ${result.state}`, [input.config.apiKey]);
            await input.failTask?.(message, payload);
            await input.saveTask({ status: "error", progress: 100, error: message, providerPayload: payload });
            return { state: "failed" as const, error: message };
        }
        if (result.state === "succeeded") {
            if (!result.mediaUrl) throw new Error("Provider completed without a video URL");
            const videoUrl = input.persistResult ? await input.persistResult(result.mediaUrl) : result.mediaUrl;
            await input.completeTask?.(videoUrl, { ...payload, providerVideoUrl: result.mediaUrl, videoUrl });
            await input.saveTask({ status: "success", progress: 100, error: "", providerPayload: { ...payload, videoUrl }, finishedAt: now });
            return { state: "completed" as const, videoUrl };
        }
        const progress = result.state === "running" ? 60 : 35;
        const nextPollAt = generationTaskNextPollAt({ now });
        await input.saveTask({ status: "running", progress, providerPayload: payload, nextPollAt });
        return { state: "pending" as const, nextPollAt };
    } catch (error) {
        const message = sanitizeSpecializedProviderMessage(error, [input.config.apiKey]);
        await input.saveTask({ status: "error", progress: 100, error: message });
        await input.failTask?.(message, task.providerPayload);
        return { state: "failed" as const, error: message };
    }
}

function toRequest(task: SmartClipRuntimeTask): SmartClipProviderRequest {
    return { clipType: task.clipType, styleId: task.styleId, title: task.title, videoUrl: task.videoUri, audioUrl: task.audioUri, language: task.language, materials: task.materials, introduceCard: task.introduceCard, packRules: task.packRules, processRules: task.processRules, structLayers: task.structLayers, subtitle: task.subtitle };
}
