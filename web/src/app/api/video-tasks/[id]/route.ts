import { after, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { canReconcileVideoTask, getVideoTask, transitionVideoTask } from "@/lib/server/video-task-store";
import { refundUserPoints } from "@/lib/auth/store";
import { fetchInternalApi, resolveInternalOrigin } from "@/lib/server/internal-origin";
import { pointsResponseHeaders } from "@/lib/server/points-response";
import { generationModelId } from "@/lib/server/generation-channel";
import { providerTaskPath } from "@/lib/server/provider-task-config";
import { runGenerationTaskRecoveryBatch } from "@/lib/server/generation-task-recovery-service";
import { systemAiBillingHeaders } from "@/lib/server/system-ai-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(request);
    const task = user ? await getVideoTask((await params).id) : null;
    if (!user || !task || (task.userId !== user.id && user.role !== "admin")) return NextResponse.json({ error: "视频任务不存在" }, { status: user ? 404 : 401 });
    if (canReconcileVideoTask(task)) {
        const origin = resolveInternalOrigin(new URL(request.url).origin);
        const cookie = request.headers.get("cookie") || "";
        after(() => runGenerationTaskRecoveryBatch({ origin, cookie, limit: 1, taskIds: [task!.id] }));
    }
    return NextResponse.json({ task: { ...publicTask(task), needsReview: task.executionPhase === "needs_review", executionPhase: task.executionPhase } }, { headers: pointsResponseHeaders(user) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(request);
    const id = (await params).id;
    const task = user ? await getVideoTask(id) : null;
    if (!user || !task || (task.userId !== user.id && user.role !== "admin")) return NextResponse.json({ error: "视频任务不存在" }, { status: user ? 404 : 401 });
    const body = (await request.json().catch(() => ({}))) as { action?: string; status?: string; result?: unknown; error?: unknown };
    if (body.result !== undefined || body.error !== undefined || (body.status && body.status !== "cancelled")) {
        return NextResponse.json({ error: "视频任务终态和结果只能由服务端更新" }, { status: 403 });
    }
    if (body.action !== "cancel" && body.status !== "cancelled") return NextResponse.json({ error: "不支持的视频任务操作" }, { status: 400 });
    if (task.status !== "running") return NextResponse.json({ error: "当前任务无法取消" }, { status: 409 });
    const next = await transitionVideoTask(task, { status: "cancelled" });
    if (!next) return NextResponse.json({ error: "当前任务状态无法修改" }, { status: 409 });
    if (task.upstream.pointsCost !== undefined && task.upstream.pointsRecordId)
        await refundUserPoints(task.userId, generationModelId(task.config), task.upstream.pointsCost, "video", task.upstream.pointsUnits || 1, `video-task:${task.id}:refund`, task.upstream.pointsRecordId);
    after(() => cancelUpstreamVideo(task, resolveInternalOrigin(new URL(request.url).origin), request.headers.get("cookie") || ""));
    const refreshedUser = await getCurrentUser();
    return NextResponse.json({ task: next ? publicTask(next) : null }, { headers: pointsResponseHeaders(refreshedUser) });
}

async function cancelUpstreamVideo(task: VideoTask, origin: string, cookie: string) {
    if (!task.upstream.id || task.upstream.id.startsWith("direct:")) return;
    const id = encodeURIComponent(task.upstream.id);
    const createPath = (task.upstream.pollPath || "/video/generations").replace(/\/+$/, "");
    const configuredCancelPath = task.config.advancedConfig?.cancelPath;
    const attempts: Array<{ path: string; method: "POST" | "DELETE" }> = [
        ...(configuredCancelPath ? [{ path: providerTaskPath(configuredCancelPath, task.upstream.id), method: task.config.advancedConfig?.cancelMethod || ("POST" as const) }] : []),
        { path: `${createPath}/${id}/cancel`, method: "POST" },
        { path: `/videos/${id}/cancel`, method: "POST" },
        { path: `/video/generations/${id}/cancel`, method: "POST" },
        { path: `${createPath}/${id}`, method: "DELETE" },
    ];
    for (const attempt of attempts) {
        const response = await fetchInternalApi(`${origin}${task.config.baseUrl.replace(/\/+$/, "")}${attempt.path}`, {
            method: attempt.method,
            headers: { ...(cookie ? { cookie } : {}), ...systemAiBillingHeaders(generationModelId(task.config), undefined, task.config.model) },
            signal: AbortSignal.timeout(10_000),
        }).catch(() => null);
        if (response?.ok) return;
    }
}

type VideoTask = NonNullable<Awaited<ReturnType<typeof getVideoTask>>>;

function publicTask(task: VideoTask) {
    return { id: task.id, status: task.status, model: generationModelId(task.config), upstreamId: task.upstream.id, durationSeconds: task.requestedDurationSeconds, result: task.result, error: task.error, canRetry: task.retryable === true };
}
