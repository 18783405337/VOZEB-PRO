import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api/points", () => ({ refreshUserPointsIfSystem: vi.fn(), syncUserPointsFromHeaders: vi.fn() }));
vi.mock("@/stores/use-config-store", () => ({ resolveModelRequestConfig: vi.fn((config: Record<string, unknown>, model: string) => ({ ...config, model })) }));

import { ImageGenerationTaskTerminalError, createImageGenerationTask, waitForImageGenerationTask } from "./image";
import type { AiConfig } from "@/stores/use-config-store";

describe("图片任务轮询", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("uses the server error message when a restored task has expired", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ error: "图片任务不存在" }, { status: 404 })),
        );

        await expect(waitForImageGenerationTask({ apiSource: "system" } as AiConfig, { id: "expired-task", kind: "generation", model: "image-model" })).rejects.toThrow("图片任务不存在");
    });

    it("sends the stable request identity in both the body and fast lookup headers", async () => {
        const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ task: { id: "image-task", kind: "generation", model: "image-model" } }));
        vi.stubGlobal("fetch", fetchMock);

        await createImageGenerationTask({ apiSource: "system", model: "image-model", imageModel: "image-model" } as AiConfig, "生成图片", [], undefined, {
            clientRequestId: "image-workbench:conversation:slot",
            attemptNo: 3,
        });

        const init = fetchMock.mock.calls[0]?.[1];
        expect(init).toBeDefined();
        if (!init) throw new Error("缺少图片任务请求参数");
        const headers = new Headers(init.headers);
        const body = JSON.parse(String(init.body)) as { context?: { clientRequestId?: string; attemptNo?: number } };
        expect(headers.get("x-vozeb-pro-client-request-id")).toBe("image-workbench:conversation:slot");
        expect(headers.get("x-vozeb-pro-attempt-no")).toBe("3");
        expect(body.context).toMatchObject({ clientRequestId: "image-workbench:conversation:slot", attemptNo: 3 });
    });

    it("stops polling when the upstream submission needs manual review", async () => {
        const fetchMock = vi.fn(async () => Response.json({ task: { id: "review-task", kind: "generation", model: "image-model", status: "running", needsReview: true } }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(waitForImageGenerationTask({ apiSource: "system" } as AiConfig, { id: "review-task", kind: "generation", model: "image-model" })).rejects.toThrow("上游创建状态待确认");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps polling the same task after a temporary query failure", async () => {
        vi.useFakeTimers();
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(Response.json({ error: "服务暂不可用" }, { status: 503 }))
            .mockResolvedValueOnce(Response.json({ task: { id: "image-task", kind: "generation", model: "image-model", status: "success", result: { dataUrl: "data:image/png;base64,AA==" } } }));
        vi.stubGlobal("fetch", fetchMock);

        const result = waitForImageGenerationTask({ apiSource: "system" } as AiConfig, { id: "image-task", kind: "generation", model: "image-model" });
        await vi.advanceTimersByTimeAsync(1800);

        await expect(result).resolves.toMatchObject({ dataUrl: "data:image/png;base64,AA==" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("marks only an explicit upstream terminal error as retryable", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ task: { id: "failed-task", kind: "generation", model: "image-model", status: "error", error: "上游生成失败", canRetry: true } })),
        );

        const error = await waitForImageGenerationTask({ apiSource: "system" } as AiConfig, { id: "failed-task", kind: "generation", model: "image-model" }).catch((reason) => reason);

        expect(error).toBeInstanceOf(ImageGenerationTaskTerminalError);
        expect(error).toMatchObject({ message: "上游生成失败", canRetry: true });
    });
});
