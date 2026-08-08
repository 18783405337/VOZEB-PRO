import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    fetchInternalApi: vi.fn(),
    fetchSafeOutbound: vi.fn(),
}));

vi.mock("@/lib/server/internal-origin", () => ({
    fetchInternalApi: mocks.fetchInternalApi,
}));

vi.mock("@/lib/server/safe-outbound-fetch", () => ({
    fetchSafeOutbound: mocks.fetchSafeOutbound,
}));

import { downloadMediaToFile } from "./media-download";
import { UnsupportedMediaContentError } from "./media-content-validation";

describe("downloadMediaToFile", () => {
    let directory = "";

    beforeEach(async () => {
        vi.clearAllMocks();
        directory = await mkdtemp(join(tmpdir(), "vozeb-media-download-test-"));
    });

    afterEach(async () => {
        await rm(directory, { recursive: true, force: true });
    });

    it("detects the real video type instead of trusting provider headers", async () => {
        const bytes = mp4Bytes();
        mocks.fetchSafeOutbound.mockResolvedValue(
            new Response(bytes, {
                status: 200,
                headers: {
                    "content-length": String(bytes.length),
                    "content-type": "application/octet-stream",
                },
            }),
        );
        const path = join(directory, "result");

        const result = await downloadMediaToFile("https://cdn.example/result", path, {
            origin: "http://localhost:3000",
            maxBytes: 1024,
            expectedType: "video",
        });

        expect(result).toEqual({
            bytes: bytes.length,
            extension: "mp4",
            mimeType: "video/mp4",
            type: "video",
        });
        expect(new Uint8Array(await readFile(path))).toEqual(bytes);
    });

    it("rejects executable content advertised as video without leaving a file", async () => {
        const bytes = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
        mocks.fetchSafeOutbound.mockResolvedValue(
            new Response(bytes, {
                status: 200,
                headers: { "content-type": "video/mp4" },
            }),
        );
        const path = join(directory, "result");

        await expect(
            downloadMediaToFile("https://cdn.example/result.mp4", path, {
                origin: "http://localhost:3000",
                maxBytes: 1024,
                expectedType: "video",
            }),
        ).rejects.toBeInstanceOf(UnsupportedMediaContentError);
        await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
    });

    it("rejects a valid media file when its detected type does not match", async () => {
        const bytes = pngBytes();
        mocks.fetchInternalApi.mockResolvedValue(new Response(bytes, { status: 200 }));

        await expect(
            downloadMediaToFile("/api/reference-assets/permanent/image.png", join(directory, "result"), {
                origin: "http://localhost:3000",
                maxBytes: 1024,
                expectedType: "video",
            }),
        ).rejects.toBeInstanceOf(UnsupportedMediaContentError);
    });
});

function mp4Bytes() {
    return new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31]);
}

function pngBytes() {
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
}
