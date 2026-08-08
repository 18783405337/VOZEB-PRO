export type AppField =
    | { key: string; kind: "text"; label: string; required: boolean; maxLength?: number }
    | { key: string; kind: "image"; label: string; required: boolean; maxItems?: number }
    | { key: string; kind: "select"; label: string; required: boolean; options: readonly string[] }
    | { key: string; kind: "number"; label: string; required: boolean; min?: number; max?: number };

export type AppDefinition = Readonly<{
    key: string;
    version: string;
    name: string;
    category: string;
    capabilities: readonly string[];
    permissions: readonly string[];
    inputSchema: readonly AppField[];
    outputSchema: Readonly<{ kind: "image" | "video" | "asset-set" }>;
    workflowKey: string;
    billingMetric: "task" | "image" | "video-second" | "workflow-step";
    defaultPricing: Readonly<{ currency: "POINT"; saleUnit: string; saleAmount: number }>;
    renderer: Readonly<{ kind: "schema" } | { kind: "custom"; key: string }>;
}>;

export const PILOT_WORKFLOW_KEYS = ["background-removal.v1", "product-image.v1", "product-promo-video.v1"] as const;

export type PilotWorkflowKey = (typeof PILOT_WORKFLOW_KEYS)[number];
