import { describe, expect, it, vi } from "vitest";

import { defaultConfig } from "@/stores/use-config-store";

import { buildVideoWorkbenchRequest } from "./video-workbench-request";

const readyConfig = {
    ...defaultConfig,
    model: "video-model",
    videoModel: "video-model",
    models: ["video-model"],
    videoModels: ["video-model"],
    size: "1024x576",
};

describe("buildVideoWorkbenchRequest", () => {
    it("拒绝空提示词且不执行模型检测", () => {
        const isAiConfigReady = vi.fn(() => true);
        const result = buildVideoWorkbenchRequest({ prompt: "  ", effectiveConfig: readyConfig, references: [], videoReferences: [], audioReferences: [], isAiConfigReady });

        expect(result).toEqual({ snapshot: null, issue: "missing-prompt", message: "请输入视频提示词" });
        expect(isAiConfigReady).not.toHaveBeenCalled();
    });

    it("保留当前精确尺寸并区分用户原文与执行提示词", () => {
        const result = buildVideoWorkbenchRequest({
            prompt: "用户原始需求",
            promptOverride: "优化后的执行提示词",
            parameterPatch: { size: "1:1" },
            effectiveConfig: readyConfig,
            references: [],
            videoReferences: [],
            audioReferences: [],
            isAiConfigReady: () => true,
        });

        expect(result.snapshot?.text).toBe("优化后的执行提示词");
        expect(result.snapshot?.userText).toBe("用户原始需求");
        expect(result.snapshot?.config.size).toBe("1024x576");
    });

    it("在模型不可用时返回可分类问题", () => {
        const result = buildVideoWorkbenchRequest({ prompt: "生成视频", effectiveConfig: readyConfig, references: [], videoReferences: [], audioReferences: [], isAiConfigReady: () => false });

        expect(result).toEqual({ snapshot: null, issue: "config-unavailable", message: "请联系管理员在后台配置可用视频模型" });
    });
});
