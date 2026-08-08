import { describe, expect, it } from "vitest";

import { parseDigitalHumanAvatarInput, parseDigitalHumanTaskInput, parseDigitalHumanVoiceInput } from "./digital-human-validation";

describe("digital human request validation", () => {
    it("requires an avatar name and media URI", () => {
        expect(() => parseDigitalHumanAvatarInput({ name: "", mediaUri: "" })).toThrow("数字人形象名称和素材地址不能为空");
        expect(parseDigitalHumanAvatarInput({ name: "  Alice  ", mediaUri: " https://cdn.example/avatar.png " })).toMatchObject({
            name: "Alice",
            mediaUri: "https://cdn.example/avatar.png",
            mediaType: "image",
        });
    });

    it("requires a voice name and audio URI", () => {
        expect(() => parseDigitalHumanVoiceInput({ name: "Voice", audioUri: "" })).toThrow("数字人音色名称和音频地址不能为空");
        expect(parseDigitalHumanVoiceInput({ name: "Voice", audioUri: "https://cdn.example/voice.mp3", durationSeconds: 12.8 })).toMatchObject({
            name: "Voice",
            audioUri: "https://cdn.example/voice.mp3",
            durationSeconds: 12,
        });
    });

    it("normalizes task defaults and rejects invalid asset references", () => {
        expect(() =>
            parseDigitalHumanTaskInput({
                avatarId: "",
                voiceId: "voice-1",
                title: "Demo",
                scriptText: "Hello",
            }),
        ).toThrow("数字人形象和音色不能为空");

        expect(
            parseDigitalHumanTaskInput({
                avatarId: "avatar-1",
                voiceId: "voice-1",
                title: "  Demo  ",
                scriptText: "  Hello  ",
            }),
        ).toMatchObject({
            avatarId: "avatar-1",
            voiceId: "voice-1",
            title: "Demo",
            scriptText: "Hello",
            mode: "standard",
            ratio: "16:9",
        });
    });
});
