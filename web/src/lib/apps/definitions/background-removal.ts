import type { AppDefinition } from "../app-definition";

export const backgroundRemoval: AppDefinition = {
    key: "background-removal",
    version: "1.0.0",
    name: "Background Removal",
    category: "image",
    capabilities: ["transparent-background", "image-editing"],
    permissions: ["tenant.apps.use.background-removal"],
    inputSchema: [
        { key: "sourceImage", kind: "image", label: "Source image", required: true, maxItems: 1 },
        { key: "quality", kind: "select", label: "Quality", required: true, options: ["standard", "high"] },
    ],
    outputSchema: { kind: "image" },
    workflowKey: "background-removal.v1",
    billingMetric: "task",
    defaultPricing: { currency: "POINT", saleUnit: "task", saleAmount: 10 },
    renderer: { kind: "custom", key: "background-removal-result" },
};
