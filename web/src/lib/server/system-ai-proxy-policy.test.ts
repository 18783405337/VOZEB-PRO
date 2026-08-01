import { describe, expect, it } from "vitest";

import { authorizeSystemAiProxyRequest } from "./system-ai-proxy-policy";

const logicalModels = [
    {
        id: "writer",
        name: "写作",
        capability: "text" as const,
        enabled: true,
        bindings: [{ id: "writer-main", channelId: "main", upstreamModel: "vendor-text", enabled: true, priority: 1 }],
    },
    {
        id: "video-pro",
        name: "视频",
        capability: "video" as const,
        enabled: true,
        bindings: [{ id: "video-main", channelId: "main", upstreamModel: "vendor-video", enabled: true, priority: 1 }],
    },
];

describe("system AI proxy policy", () => {
    it("allows a billed create path for the bound logical model", () => {
        expect(
            authorizeSystemAiProxyRequest({
                method: "POST",
                path: ["chat", "completions"],
                search: "",
                channelId: "main",
                upstreamModel: "vendor-text",
                preferredLogicalModelId: "writer",
                logicalModels,
                apiFormat: "openai",
                pointsUsageKind: "text",
            }),
        ).toMatchObject({ allowed: true, logicalModelId: "writer", operation: "create" });
    });

    it("rejects unbound models, unknown paths, and unbilled create requests", () => {
        const base = { method: "POST", search: "", channelId: "main", preferredLogicalModelId: "", logicalModels, apiFormat: "openai" as const };
        expect(authorizeSystemAiProxyRequest({ ...base, path: ["chat", "completions"], upstreamModel: "unknown", pointsUsageKind: "text" })).toMatchObject({ allowed: false, status: 403 });
        expect(authorizeSystemAiProxyRequest({ ...base, path: ["account", "balance"], upstreamModel: "vendor-text", pointsUsageKind: "text" })).toMatchObject({ allowed: false, status: 404 });
        expect(authorizeSystemAiProxyRequest({ ...base, path: ["chat", "completions"], upstreamModel: "vendor-text" })).toMatchObject({ allowed: false, status: 400 });
    });

    it("allows only configured query and cancel task paths", () => {
        const base = {
            channelId: "main",
            upstreamModel: "vendor-video",
            preferredLogicalModelId: "video-pro",
            logicalModels,
            apiFormat: "openai" as const,
            paths: { create: ["/jobs/video"], query: ["/jobs/video/:task_id"], cancel: [{ path: "/jobs/video/:task_id/cancel", method: "POST" }] },
        };
        expect(authorizeSystemAiProxyRequest({ ...base, method: "GET", path: ["jobs", "video", "task-one"], search: "" })).toMatchObject({ allowed: true, operation: "query" });
        expect(authorizeSystemAiProxyRequest({ ...base, method: "POST", path: ["jobs", "video", "task-one", "cancel"], search: "" })).toMatchObject({ allowed: true, operation: "cancel" });
        expect(authorizeSystemAiProxyRequest({ ...base, method: "GET", path: ["jobs", "other", "task-one"], search: "" })).toMatchObject({ allowed: false, status: 404 });
    });

    it("rejects unsupported methods and mismatched logical capabilities", () => {
        expect(
            authorizeSystemAiProxyRequest({
                method: "PUT",
                path: ["chat", "completions"],
                search: "",
                channelId: "main",
                upstreamModel: "vendor-text",
                logicalModels,
                apiFormat: "openai",
                pointsUsageKind: "text",
            }),
        ).toMatchObject({ allowed: false, status: 405 });
        expect(
            authorizeSystemAiProxyRequest({
                method: "POST",
                path: ["responses"],
                search: "",
                channelId: "main",
                upstreamModel: "vendor-text",
                logicalModels,
                apiFormat: "openai",
                pointsUsageKind: "image",
            }),
        ).toMatchObject({ allowed: false, status: 403 });
    });
});
