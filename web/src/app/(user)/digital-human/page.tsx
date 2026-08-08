import type { Metadata } from "next";

import { DigitalHumanWorkspace } from "./digital-human-workspace";

export const metadata: Metadata = {
    title: "数字人",
    description: "管理数字人形象、音色并创建视频任务。",
};

export default function DigitalHumanPage() {
    return <DigitalHumanWorkspace />;
}
