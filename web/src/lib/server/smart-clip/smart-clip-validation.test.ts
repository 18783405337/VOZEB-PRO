import { describe, expect, it } from "vitest";

import { parseSmartClipTaskInput } from "./smart-clip-validation";

describe("smart clip request validation", () => {
    it("normalizes a valid source-video request", () => {
        expect(
            parseSmartClipTaskInput({
                clipType: "realman_broadcast",
                title: "  Demo  ",
                videoUri: " https://cdn.example/source.mp4 ",
                durationSeconds: 60.8,
            }),
        ).toMatchObject({
            clipType: "realman_broadcast",
            title: "Demo",
            videoUri: "https://cdn.example/source.mp4",
            ratio: "duration",
            durationSeconds: 60,
            quantity: 1,
        });
    });

    it("requires a supported type, title, and source", () => {
        expect(() => parseSmartClipTaskInput({ clipType: "unknown", title: "Demo", videoUri: "https://cdn.example/source.mp4" })).toThrow("Unsupported smart clip type");
        expect(() => parseSmartClipTaskInput({ clipType: "broadcast_mixcut", title: "", materials: ["https://cdn.example/a.mp4"] })).toThrow("title is required");
        expect(() => parseSmartClipTaskInput({ clipType: "news_mixcut", title: "Demo" })).toThrow("Provide a source");
    });

    it("accepts a material-only request and rejects unsupported ratios", () => {
        expect(
            parseSmartClipTaskInput({
                clipType: "broadcast_mixcut",
                title: "Materials",
                materials: [{ type: "video", url: "https://cdn.example/a.mp4" }],
            }),
        ).toMatchObject({ clipType: "broadcast_mixcut", materials: [{ type: "video", url: "https://cdn.example/a.mp4" }] });
        expect(() =>
            parseSmartClipTaskInput({
                clipType: "broadcast_mixcut",
                title: "Materials",
                materials: ["https://cdn.example/a.mp4"],
                ratio: "2:1",
            }),
        ).toThrow("Unsupported smart clip ratio");
    });
});
