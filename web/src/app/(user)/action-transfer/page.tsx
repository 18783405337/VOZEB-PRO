import type { Metadata } from "next";

import { ActionTransferWorkspace } from "./action-transfer-workspace";

export const metadata: Metadata = {
    title: "动作迁移",
    description: "使用人物参考图和动作视频创建动作迁移任务。",
};

export default function ActionTransferPage() {
    return <ActionTransferWorkspace />;
}
