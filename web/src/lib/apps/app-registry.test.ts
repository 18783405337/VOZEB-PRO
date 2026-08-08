import { describe, expect, it } from "vitest";

import type { AppDefinition } from "./app-definition";
import { appRegistry, createAppRegistry } from "./app-registry";

const backgroundRemoval: AppDefinition = {
    key: "background-removal",
    version: "1.0.0",
    name: "Background Removal",
    category: "image",
    capabilities: ["image"],
    permissions: ["app.background-removal.use"],
    inputSchema: [{ key: "image", kind: "image", label: "Image", required: true, maxItems: 1 }],
    outputSchema: { kind: "image" },
    workflowKey: "background-removal.v1",
    billingMetric: "task",
    defaultPricing: { currency: "POINT", saleUnit: "task", saleAmount: 10 },
    renderer: { kind: "schema" },
};

describe("application registry", () => {
    it("rejects duplicate application versions", () => {
        expect(() => createAppRegistry([backgroundRemoval, backgroundRemoval])).toThrow("Duplicate application version: background-removal@1.0.0");
    });

    it("rejects workflow keys outside the reviewed workflow set", () => {
        expect(() => createAppRegistry([{ ...backgroundRemoval, workflowKey: "unreviewed.v1" }])).toThrow("Unknown application workflow: unreviewed.v1");
    });

    it("looks up a definition by stable key and version", () => {
        const registry = createAppRegistry([backgroundRemoval]);

        expect(registry.get("background-removal", "1.0.0")?.workflowKey).toBe("background-removal.v1");
        expect(registry.get("background-removal", "2.0.0")).toBeUndefined();
    });

    it("returns immutable definitions and immutable lookup results", () => {
        const registry = createAppRegistry([backgroundRemoval]);
        const definition = registry.get("background-removal", "1.0.0");

        expect(definition).toBeDefined();
        expect(Object.isFrozen(definition)).toBe(true);
        expect(Object.isFrozen(definition?.inputSchema)).toBe(true);
        expect(() => {
            (definition as { name: string }).name = "Changed";
        }).toThrow();
    });

    it.each([
        {
            appKey: "aigc-digital-human",
            workflowKey: "aigc-digital-human.v1",
            requiredFields: ["avatar", "voice", "scriptText"],
        },
        {
            appKey: "image-human",
            workflowKey: "image-human.v1",
            requiredFields: ["sourceImage", "referenceAudio", "scriptText"],
        },
        {
            appKey: "action-transfer",
            workflowKey: "action-transfer.v1",
            requiredFields: ["referenceImages", "sourceVideo"],
        },
    ])("registers the reviewed $appKey application", ({ appKey, workflowKey, requiredFields }) => {
        const definition = appRegistry.get(appKey, "1.0.0");

        expect(definition).toBeDefined();
        expect(definition?.workflowKey).toBe(workflowKey);
        expect(definition?.outputSchema).toEqual({ kind: "video" });
        expect(definition?.inputSchema.map((field) => field.key)).toEqual(expect.arrayContaining(requiredFields));
        expect(Object.isFrozen(definition)).toBe(true);
    });

    it("keeps the action transfer limits compatible with the original application", () => {
        const definition = appRegistry.get("action-transfer", "1.0.0");
        const referenceImages = definition?.inputSchema.find((field) => field.key === "referenceImages");
        const mode = definition?.inputSchema.find((field) => field.key === "mode");
        const faceCount = definition?.inputSchema.find((field) => field.key === "faceCount");

        expect(referenceImages).toMatchObject({ kind: "images", maxItems: 3 });
        expect(mode).toMatchObject({ kind: "select", options: ["fast", "standard", "max"] });
        expect(faceCount).toMatchObject({ kind: "number", max: 7 });
    });
});
