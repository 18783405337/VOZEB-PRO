import { describe, expect, it } from "vitest";

import { imageResultsToReferences } from "./drama-assets-panel";

describe("drama asset image results", () => {
    it("keeps every generated image as a candidate reference", () => {
        const references = imageResultsToReferences({
            dataUrl: "data:image/png;base64,first",
            serverUrl: "/api/generation-log-assets/first.png",
            results: [
                { dataUrl: "data:image/png;base64,first", serverUrl: "/api/generation-log-assets/first.png", width: 1024, height: 1024 },
                { serverUrl: "/api/generation-log-assets/second.png", width: 1024, height: 1024 },
            ],
        });

        expect(references).toHaveLength(2);
        expect(references.map((item) => item.url)).toEqual(["/api/generation-log-assets/first.png", "/api/generation-log-assets/second.png"]);
        expect(references.map((item) => item.label)).toEqual(["AI 候选图 1", "AI 候选图 2"]);
    });
});
