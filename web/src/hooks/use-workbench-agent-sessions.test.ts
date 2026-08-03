import { describe, expect, it } from "vitest";

import { isCurrentWorkbenchSession } from "./use-workbench-agent-sessions";

describe("workbench session selection", () => {
    it("rejects a history response after the user creates another session", () => {
        const context = { key: "user:image", generation: 1 };

        expect(isCurrentWorkbenchSession(context, context, "new-session", "old-session")).toBe(false);
    });

    it("rejects a response from a previous user or workspace generation", () => {
        expect(isCurrentWorkbenchSession({ key: "user:image", generation: 2 }, { key: "user:image", generation: 1 }, "session", "session")).toBe(false);
    });

    it("accepts only the response for the active session and context", () => {
        const context = { key: "user:image", generation: 2 };

        expect(isCurrentWorkbenchSession(context, context, "session", "session")).toBe(true);
    });
});
