import { describe, expect, it } from "vitest";

import { getTenantPageContext } from "./tenant-page-context";

describe("tenant page context", () => {
    it("exports the server-side page context helper", () => {
        expect(getTenantPageContext).toBeTypeOf("function");
    });
});
