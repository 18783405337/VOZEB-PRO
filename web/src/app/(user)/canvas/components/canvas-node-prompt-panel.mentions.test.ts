import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "src/app/(user)/canvas/components/canvas-node-prompt-panel.tsx"), "utf8");

describe("canvas video connected image list", () => {
    it("shows active connected images and inserts their mention at the cursor", () => {
        expect(source).toContain('mode === "video"');
        expect(source).toContain('reference.active && reference.kind === "image"');
        expect(source).toContain("已连接图片 · 点击插入引用");
        expect(source).toContain("imagePreviewUrl(reference.previewUrl, 96)");
        expect(source).toContain("insertImageMention(reference.label)");
        expect(source).toContain("selectionStart");
        expect(source).toContain("selectionEnd");
    });
});
