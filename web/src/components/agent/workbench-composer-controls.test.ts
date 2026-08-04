import { describe, expect, it } from "vitest";

import { resolveWorkbenchHydrationDraft } from "./workbench-composer-controls";

describe("workbench prompt hydration", () => {
    it("recovers text entered before React hydration", () => {
        expect(resolveWorkbenchHydrationDraft("", "生成小狗")).toBe("生成小狗");
    });

    it("keeps the controlled draft when it already exists", () => {
        expect(resolveWorkbenchHydrationDraft("生成唐老鸭", "过期的 DOM 输入")).toBe("生成唐老鸭");
    });
});
