import type { Metadata } from "next";

import { ImageHumanWorkspace } from "./image-human-workspace";

export const metadata: Metadata = {
    title: "图片数字人",
    description: "使用人物图片和驱动音频创建数字人视频。",
};

export default function ImageHumanPage() {
    return <ImageHumanWorkspace />;
}
