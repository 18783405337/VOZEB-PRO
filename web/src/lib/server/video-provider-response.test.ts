import { describe, expect, it } from "vitest";

import { readVideoProviderError, readVideoProviderUrl } from "./video-provider-response";

describe("video provider response", () => {
    it("ignores provider error text in media URL fields", () => {
        expect(readVideoProviderUrl({ status: "failed", url: "服务器忙" }, "video_url / url / metadata.url")).toBe("");
        expect(readVideoProviderUrl({ status: "completed", video_url: "none", url: "https://cdn.example.com/final.mp4" }, "video_url / url")).toBe("https://cdn.example.com/final.mp4");
        expect(readVideoProviderUrl({ data: { url: "/generated/final.mp4" } }, "data.url / url")).toBe("/generated/final.mp4");
        expect(readVideoProviderError({ status: "failed", url: "服务器忙" })).toBe("服务器忙");
    });
});
