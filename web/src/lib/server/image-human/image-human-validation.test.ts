import { describe, expect, it } from "vitest";

import { parseImageHumanTaskInput } from "./image-human-validation";

describe("image human request validation", () => {
    it("normalizes a source-compatible task request", () => {
        expect(
            parseImageHumanTaskInput({
                title: "  Presenter demo  ",
                imageUrl: " https://cdn.example/avatar.png ",
                audioUrl: " https://cdn.example/voice.mp3 ",
                scriptText: "  Hello  ",
                prompt: " Friendly ",
                duration: 12.8,
            }),
        ).toEqual({
            title: "Presenter demo",
            imageUrl: "https://cdn.example/avatar.png",
            audioUrl: "https://cdn.example/voice.mp3",
            scriptText: "Hello",
            prompt: "Friendly",
            duration: 12,
            mode: "standard",
        });
    });

    it("requires HTTPS image and audio URLs", () => {
        expect(() =>
            parseImageHumanTaskInput({
                imageUrl: "http://cdn.example/avatar.png",
                audioUrl: "https://cdn.example/voice.mp3",
                duration: 10,
            }),
        ).toThrow("人物图片和驱动音频必须使用 HTTPS 地址");
    });

    it("rejects unsupported modes and out-of-range durations", () => {
        expect(() =>
            parseImageHumanTaskInput({
                imageUrl: "https://cdn.example/avatar.png",
                audioUrl: "https://cdn.example/voice.mp3",
                duration: 0,
            }),
        ).toThrow("预计时长必须在 1 到 300 秒之间");
        expect(() =>
            parseImageHumanTaskInput({
                imageUrl: "https://cdn.example/avatar.png",
                audioUrl: "https://cdn.example/voice.mp3",
                duration: 10,
                mode: "fast",
            }),
        ).toThrow("生成模式不受支持");
    });
});
