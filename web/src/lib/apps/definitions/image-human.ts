import type { AppDefinition } from "../app-definition";

export const imageHuman: AppDefinition = {
    key: "image-human",
    version: "1.0.0",
    name: "图片数字人",
    category: "video",
    capabilities: ["image-human", "audio-driven-video", "lip-sync"],
    permissions: ["tenant.apps.use.image-human"],
    inputSchema: [
        { key: "sourceImage", kind: "image", label: "人物图片", required: true, maxItems: 1 },
        { key: "referenceAudio", kind: "audio", label: "驱动音频", required: true, maxItems: 1 },
        { key: "scriptText", kind: "text", label: "播报文案", required: false, maxLength: 5000 },
        { key: "prompt", kind: "text", label: "生成提示词", required: false, maxLength: 2000 },
        { key: "mode", kind: "select", label: "生成模式", required: true, options: ["standard", "pro"] },
        { key: "duration", kind: "number", label: "预计时长", required: true, min: 1, max: 300 },
    ],
    outputSchema: { kind: "video" },
    workflowKey: "image-human.v1",
    billingMetric: "video-second",
    defaultPricing: { currency: "POINT", saleUnit: "second", saleAmount: 12 },
    renderer: { kind: "custom", key: "image-human-result" },
};
