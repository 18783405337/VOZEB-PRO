import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("smart clip production contracts", () => {
    it("is included in the durable generation task type and worker dispatch", () => {
        const types = readFileSync(resolve(process.cwd(), "src/lib/server/generation-task-types.ts"), "utf8");
        const recovery = readFileSync(resolve(process.cwd(), "src/lib/server/generation-task-recovery-service.ts"), "utf8");
        expect(types).toContain('"smart-clip"');
        expect(recovery).toContain('lease.type === "smart-clip"');
        expect(recovery).toContain('taskType: "smart-clip"');
    });
});
