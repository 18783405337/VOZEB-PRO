import { describe, expect, it } from "vitest";

import type { AppDefinition } from "./app-definition";
import { createAppRegistry } from "./app-registry";

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
});
