import { describe, expect, it } from "vitest";

import { ActionTransferInputError, parseActionTransferTaskInput } from "./action-transfer-validation";

describe("parseActionTransferTaskInput", () => {
    it("normalizes the original action transfer inputs", () => {
        expect(
            parseActionTransferTaskInput({
                title: " Dance ",
                referenceImages: ["https://cdn.example/person-1.png", "https://cdn.example/person-2.png"],
                sourceVideo: "https://cdn.example/motion.mp4",
                prompt: " Keep camera ",
                mode: "max",
                faceCount: 2,
                duration: 12.8,
            }),
        ).toEqual({
            title: "Dance",
            referenceImages: ["https://cdn.example/person-1.png", "https://cdn.example/person-2.png"],
            sourceVideo: "https://cdn.example/motion.mp4",
            prompt: "Keep camera",
            mode: "max",
            faceCount: 2,
            duration: 12,
        });
    });

    it("rejects more than three reference images", () => {
        expect(() =>
            parseActionTransferTaskInput({
                referenceImages: [
                    "https://cdn.example/1.png",
                    "https://cdn.example/2.png",
                    "https://cdn.example/3.png",
                    "https://cdn.example/4.png",
                ],
                sourceVideo: "https://cdn.example/motion.mp4",
                duration: 10,
            }),
        ).toThrow(ActionTransferInputError);
    });

    it("requires HTTPS assets and the original mode and face ranges", () => {
        expect(() =>
            parseActionTransferTaskInput({
                referenceImages: ["http://cdn.example/person.png"],
                sourceVideo: "https://cdn.example/motion.mp4",
                duration: 10,
            }),
        ).toThrow("HTTPS");
        expect(() =>
            parseActionTransferTaskInput({
                referenceImages: ["https://cdn.example/person.png"],
                sourceVideo: "https://cdn.example/motion.mp4",
                mode: "pro",
                duration: 10,
            }),
        ).toThrow("生成模式");
        expect(() =>
            parseActionTransferTaskInput({
                referenceImages: ["https://cdn.example/person.png"],
                sourceVideo: "https://cdn.example/motion.mp4",
                faceCount: 8,
                duration: 10,
            }),
        ).toThrow("人物数量");
    });
});
