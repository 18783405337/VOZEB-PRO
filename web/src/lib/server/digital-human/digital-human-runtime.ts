import type { GenerationTaskLease, GenerationTaskSchedulePatch } from "@/lib/server/generation-task-scheduler";

export type SpecializedTaskRuntimeContext = {
    origin: string;
    publicOrigin: string;
    cookie: string;
};

export type SpecializedTaskRuntimeStep = {
    state: "pending" | "result_ready" | "completed" | "failed" | "needs_review" | "deferred";
    patch: GenerationTaskSchedulePatch;
};

export async function runDigitalHumanTaskStep(_lease: GenerationTaskLease, _context: SpecializedTaskRuntimeContext): Promise<SpecializedTaskRuntimeStep> {
    return {
        state: "needs_review",
        patch: {
            executionPhase: "needs_review",
            nextPollAt: undefined,
            lastUpstreamStatus: "digital_human_runtime_not_implemented",
        },
    };
}
