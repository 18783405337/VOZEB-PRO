import type { AppDefinition } from "../app-definition";

export const productImage: AppDefinition = {
    key: "product-image",
    version: "1.0.0",
    name: "Product Image",
    category: "commerce",
    capabilities: ["product-image", "template", "custom-scene"],
    permissions: ["tenant.apps.use.product-image"],
    inputSchema: [
        { key: "productImage", kind: "image", label: "Product image", required: true, maxItems: 1 },
        { key: "mode", kind: "select", label: "Mode", required: true, options: ["template", "custom"] },
        { key: "prompt", kind: "text", label: "Prompt", required: false, maxLength: 2000 },
    ],
    outputSchema: { kind: "image" },
    workflowKey: "product-image.v1",
    billingMetric: "image",
    defaultPricing: { currency: "POINT", saleUnit: "image", saleAmount: 20 },
    renderer: { kind: "schema" },
};
