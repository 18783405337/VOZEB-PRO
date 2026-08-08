import type { AppDefinition } from "../app-definition";

export const actionTransfer: AppDefinition = {
    key: "action-transfer",
    version: "1.0.0",
    name: "动作迁移",
    category: "video",
    capabilities: ["action-transfer", "reference-image", "video-to-video"],
    permissions: ["tenant.apps.use.action-transfer"],
    inputSchema: [
        { key: "referenceImages", kind: "image", label: "人物参考图", required: true, maxItems: 5 },
        { key: "sourceVideo", kind: "video", label: "动作源视频", required: true, maxItems: 1 },
        { key: "prompt", kind: "text", label: "生成提示词", required: false, maxLength: 2000 },
        { key: "mode", kind: "select", label: "生成模式", required: true, options: ["standard", "pro"] },
        { key: "faceCount", kind: "number", label: "人物数量", required: false, min: 1, max: 5 },
        { key: "duration", kind: "number", label: "预计时长", required: true, min: 1, max: 300 },
    ],
    outputSchema: { kind: "video" },
    workflowKey: "action-transfer.v1",
    billingMetric: "video-second",
    defaultPricing: { currency: "POINT", saleUnit: "second", saleAmount: 15 },
    renderer: { kind: "custom", key: "action-transfer-result" },
};
