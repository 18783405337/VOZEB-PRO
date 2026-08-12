import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSignedUrl: vi.fn(async () => "https://oss.example.com/signed"),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.getSignedUrl }));

import { signObjectRead } from "./object-storage-client";

describe("object storage client", () => {
    it("does not override response content-type in signed read URLs for OSS compatibility", async () => {
        await signObjectRead(
            {
                id: "default",
                enabled: true,
                endpoint: "https://oss-cn-hongkong.aliyuncs.com",
                region: "oss-cn-hongkong",
                bucket: "media",
                prefix: "vozeb-pro",
                accessKeyId: "access",
                secretAccessKey: "secret",
                forcePathStyle: false,
            },
            { key: "vozeb-pro/media/reference/file.jpg", contentType: "image/jpeg", contentDisposition: "inline" },
        );

        const calls = mocks.getSignedUrl.mock.calls as unknown as Array<[unknown, { input?: Record<string, unknown> }, unknown?]>;
        const command = calls[0]?.[1];
        expect(command.input).toMatchObject({ Bucket: "media", Key: "vozeb-pro/media/reference/file.jpg", ResponseContentDisposition: "inline" });
        expect(command.input).not.toHaveProperty("ResponseContentType");
    });
});
