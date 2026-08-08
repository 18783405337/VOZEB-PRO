import type { AppDefinition } from "../app-definition";

export const aigcDigitalHuman: AppDefinition = {
    key: "aigc-digital-human",
    version: "1.0.0",
    name: "数字人",
    category: "video",
    capabilities: ["avatar-video", "text-to-speech", "lip-sync"],
    permissions: ["tenant.apps.use.aigc-digital-human"],
    inputSchema: [
        { key: "avatar", kind: "image", label: "数字人形象", required: true, maxItems: 1 },
        { key: "voice", kind: "audio", label: "声音素材", required: true, maxItems: 1 },
        { key: "scriptText", kind: "text", label: "播报文案", required: true, maxLength: 5000 },
        { key: "prompt", kind: "text", label: "生成提示词", required: false, maxLength: 2000 },
        { key: "mode", kind: "select", label: "生成模式", required: true, options: ["standard", "pro"] },
    ],
    outputSchema: { kind: "video" },
    workflowKey: "aigc-digital-human.v1",
    billingMetric: "video-second",
    defaultPricing: { currency: "POINT", saleUnit: "second", saleAmount: 10 },
    renderer: { kind: "custom", key: "digital-human-result" },
};
