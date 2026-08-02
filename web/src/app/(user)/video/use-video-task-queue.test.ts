import { describe, expect, it } from "vitest";

import { reserveVideoSubmissionSlot } from "./use-video-task-queue";

describe("video task submission reservation", () => {
    it("rejects a rapid second submission after the first click reserves the only slot", () => {
        const first = reserveVideoSubmissionSlot(0, 0, 1);
        const second = reserveVideoSubmissionSlot(0, first || 0, 1);

        expect(first).toBe(1);
        expect(second).toBeNull();
    });

    it("respects higher configured concurrency without exceeding it", () => {
        const first = reserveVideoSubmissionSlot(0, 0, 2);
        const second = reserveVideoSubmissionSlot(0, first || 0, 2);
        const third = reserveVideoSubmissionSlot(0, second || 0, 2);

        expect([first, second, third]).toEqual([1, 2, null]);
    });
});
