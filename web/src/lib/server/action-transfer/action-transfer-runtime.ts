import type { GenerationTaskLease } from "@/lib/server/generation-task-scheduler";
import type { SpecializedTaskRuntimeContext, SpecializedTaskRuntimeStep } from "@/lib/server/digital-human/digital-human-runtime";

export async function runActionTransferTaskStep(_lease: GenerationTaskLease, _context: SpecializedTaskRuntimeContext): Promise<SpecializedTaskRuntimeStep> {
    return {
        state: "needs_review",
        patch: {
            executionPhase: "needs_review",
            nextPollAt: undefined,
            lastUpstreamStatus: "action_transfer_runtime_not_implemented",
        },
    };
}
