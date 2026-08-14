import { describe, expect, it } from "vitest";

import { mentionedReferenceIndexes, replaceMentionedReferences, selectMentionedReferences } from "./canvas-node-generation";

const noMentions = { image: [], video: [], audio: [] };

describe("canvas media mentions", () => {
    it("extracts unique one-based indexes independently by media kind", () => {
        const prompt = "让 @视频2 负责运镜，@图片2 做人物，@图片1 做场景，@视频2 保持节奏";
        expect(mentionedReferenceIndexes(prompt, "image")).toEqual([1, 0]);
        expect(mentionedReferenceIndexes(prompt, "video")).toEqual([1]);
        expect(mentionedReferenceIndexes(prompt, "audio")).toEqual([]);
    });

    it("selects and orders only explicitly mentioned resources", () => {
        expect(selectMentionedReferences(["image-one", "image-two"], [1, 0])).toEqual(["image-two", "image-one"]);
        expect(selectMentionedReferences(["video-one", "video-two"], [1])).toEqual(["video-two"]);
        expect(selectMentionedReferences(["audio-one"], [])).toEqual(["audio-one"]);
    });

    it("remaps mixed media labels independently for the provider", () => {
        expect(
            replaceMentionedReferences("参考 @视频2 的运镜，让 @图片2 的人物进入 @图片1 的场景", {
                image: [1, 0],
                video: [1],
                audio: [],
            }),
        ).toBe("参考 视频1 的运镜，让 图片1 的人物进入 图片2 的场景");
    });

    it("does not change prompts without mentions", () => {
        expect(mentionedReferenceIndexes("生成一段城市夜景", "image")).toEqual([]);
        expect(replaceMentionedReferences("生成一段城市夜景", noMentions)).toBe("生成一段城市夜景");
    });
});
