import type { AppDefinition } from "../app-definition";

export const productPromoVideo: AppDefinition = {
    key: "product-promo-video",
    version: "1.0.0",
    name: "Product Promo Video",
    category: "commerce",
    capabilities: ["image-to-video", "prompt-enhancement"],
    permissions: ["tenant.apps.use.product-promo-video"],
    inputSchema: [
        { key: "sourceImage", kind: "image", label: "Source image", required: true, maxItems: 1 },
        { key: "type", kind: "select", label: "Video type", required: true, options: ["showcase", "lifestyle"] },
        { key: "ratio", kind: "select", label: "Ratio", required: true, options: ["16:9", "9:16", "1:1"] },
        { key: "duration", kind: "number", label: "Duration", required: true, min: 3, max: 15 },
        { key: "prompt", kind: "text", label: "Prompt", required: false, maxLength: 2000 },
    ],
    outputSchema: { kind: "video" },
    workflowKey: "product-promo-video.v1",
    billingMetric: "video-second",
    defaultPricing: { currency: "POINT", saleUnit: "second", saleAmount: 8 },
    renderer: { kind: "schema" },
};
