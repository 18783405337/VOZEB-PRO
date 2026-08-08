import { describe, expect, it } from "vitest";

import { extractProviderError, extractProviderMediaUrls, extractProviderTaskId, normalizeProviderTaskState, requireProviderTaskId } from "./provider-response";

describe("specialized provider response compatibility", () => {
    it.each([
        [{ task_id: "root-task" }, "root-task"],
        [{ data: { id: "data-task" } }, "data-task"],
        [{ result: { task_id: "result-task" } }, "result-task"],
        [{ data: { task: { task_id: "nested-task" } } }, "nested-task"],
    ])("extracts task identifiers from compatible response shapes", (payload, expected) => {
        expect(extractProviderTaskId(payload)).toBe(expected);
    });

    it.each([
        [{ status: "queued" }, "pending"],
        [{ data: { state: "processing" } }, "running"],
        [{ result: { status: "succeeded" } }, "succeeded"],
        [{ data: { result: { state: "failed" } } }, "failed"],
        [{ status: "cancelled" }, "cancelled"],
    ] as const)("normalizes provider task state", (payload, expected) => {
        expect(normalizeProviderTaskState(payload)).toBe(expected);
    });

    it.each([
        [{ data: { task_status: "submitted" } }, "pending"],
        [{ data: { task_status: "processing" } }, "running"],
        [{ data: { task_status: "succeed" } }, "succeeded"],
        [{ data: { task_status: "failed" } }, "failed"],
    ] as const)("normalizes Kling task_status values", (payload, expected) => {
        expect(normalizeProviderTaskState(payload)).toBe(expected);
    });

    it("extracts and deduplicates audio and video media URLs", () => {
        const payload = {
            audio_url: "https://cdn.example.com/audio.mp3",
            data: {
                output: {
                    video_url: "https://cdn.example.com/video.mp4",
                },
                results: [{ url: "https://cdn.example.com/video.mp4" }, { output_url: "https://cdn.example.com/alternate.mp4" }],
            },
        };

        expect(extractProviderMediaUrls(payload, "audio")).toEqual(["https://cdn.example.com/audio.mp3"]);
        expect(extractProviderMediaUrls(payload, "video")).toEqual(["https://cdn.example.com/video.mp4", "https://cdn.example.com/alternate.mp4"]);
    });

    it("extracts Kling avatar videos from task_result", () => {
        expect(
            extractProviderMediaUrls(
                {
                    data: {
                        task_result: {
                            videos: [{ id: "video-1", url: "https://cdn.example/avatar.mp4" }],
                        },
                    },
                },
                "video",
            ),
        ).toEqual(["https://cdn.example/avatar.mp4"]);
    });

    it("rejects malformed accepted responses and normalizes terminal errors", () => {
        expect(() => requireProviderTaskId({ code: 200, data: {} })).toThrowError(expect.objectContaining({ code: "MALFORMED_RESPONSE" }));
        expect(extractProviderError({ data: { result: { error: "render failed" } } })).toBe("render failed");
        expect(normalizeProviderTaskState({ state: "error" })).toBe("failed");
    });
});
