import { describe, expect, it } from "vitest";

import { mentionedReferenceIndexes, replaceMentionedReferences } from "./canvas-node-generation";

describe("canvas image mentions", () => {
    it("extracts unique one-based image indexes in prompt order", () => {
        expect(mentionedReferenceIndexes("让 @图片2 做人物，@图片1 做场景，@图片2 保持一致", "image")).toEqual([1, 0]);
    });

    it("leaves prompts readable for the provider", () => {
        expect(replaceMentionedReferences("让 @图片2 做人物", [1])).toBe("让 图片2 做人物");
    });

    it("does not change prompts without mentions", () => {
        expect(mentionedReferenceIndexes("生成一段城市夜景", "image")).toEqual([]);
        expect(replaceMentionedReferences("生成一段城市夜景", [])).toBe("生成一段城市夜景");
    });
});
