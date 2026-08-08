import { describe, expect, it } from "vitest";

import { resolveAppConfig } from "./app-config-resolver";

describe("resolveAppConfig", () => {
    it("merges platform, tenant, installation, and allowed request configuration in precedence order", () => {
        expect(
            resolveAppConfig({
                platformDefaults: { quality: "standard", count: 1 },
                tenantOverrides: { quality: "high" },
                installSettings: { count: 2 },
                requestOverrides: { count: 3, quality: "draft" },
                allowedRequestOverrideKeys: ["count"],
            }),
        ).toEqual({ quality: "high", count: 3 });
    });
});
