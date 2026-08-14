"use client";

import { Button, Dropdown, Modal, Space, message } from "antd";
import { Copy, MoreVertical, Play, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SceneGroup } from "@/lib/drama-scene-types";
import type { DramaShot } from "@/lib/drama-project-contract";

interface SceneBatchActionsProps {
    selectedScenes: SceneGroup[];
    shots: DramaShot[];
    onBatchGenerate: (sceneIds: string[]) => void;
    onBatchDuplicate: (sceneIds: string[]) => void;
    onBatchDelete: (sceneIds: string[]) => void;
    onBatchUpdate: (sceneIds: string[], updates: Partial<SceneGroup>) => void;
    disabled?: boolean;
}

export function SceneBatchActions({
    selectedScenes,
    shots,
    onBatchGenerate,
    onBatchDuplicate,
    onBatchDelete,
    onBatchUpdate,
    disabled,
}: SceneBatchActionsProps) {
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [batchSettings, setBatchSettings] = useState<Partial<SceneGroup>>({});

    const sceneIds = selectedScenes.map((s) => s.id);
    const totalShots = selectedScenes.reduce((sum, scene) => sum + scene.shotIds.length, 0);
    const totalDuration = selectedScenes.reduce((sum, scene) => {
        const sceneShots = shots.filter((shot) => scene.shotIds.includes(shot.id));
        return sum + sceneShots.reduce((shotSum, shot) => shotSum + shot.duration, 0);
    }, 0);

    const handleBatchGenerate = () => {
        Modal.confirm({
            title: "批量生成场景",
            content: `确定要生成选中的 ${selectedScenes.length} 个场景（共 ${totalShots} 个镜头）吗？`,
            okText: "确定生成",
            cancelText: "取消",
            onOk: () => {
                onBatchGenerate(sceneIds);
                message.success(`已开始生成 ${totalShots} 个镜头`);
            },
        });
    };

    const handleBatchDuplicate = () => {
        Modal.confirm({
            title: "批量复制场景",
            content: `确定要复制选中的 ${selectedScenes.length} 个场景吗？`,
            okText: "确定复制",
            cancelText: "取消",
            onOk: () => {
                onBatchDuplicate(sceneIds);
                message.success(`已复制 ${selectedScenes.length} 个场景`);
            },
        });
    };

    const handleBatchDelete = () => {
        Modal.confirm({
            title: "批量删除场景",
            content: `确定要删除选中的 ${selectedScenes.length} 个场景（共 ${totalShots} 个镜头）吗？此操作不可恢复。`,
            okText: "确定删除",
            okType: "danger",
            cancelText: "取消",
            onOk: () => {
                onBatchDelete(sceneIds);
                message.success(`已删除 ${selectedScenes.length} 个场景`);
            },
        });
    };

    const handleBatchSettings = () => {
        setShowSettingsModal(true);
    };

    const applyBatchSettings = () => {
        if (Object.keys(batchSettings).length === 0) {
            message.warning("请至少设置一个属性");
            return;
        }
        onBatchUpdate(sceneIds, batchSettings);
        message.success(`已更新 ${selectedScenes.length} 个场景`);
        setShowSettingsModal(false);
        setBatchSettings({});
    };

    const menuItems = [
        {
            key: "generate",
            label: "批量生成",
            icon: <Play className="size-3.5" />,
            onClick: handleBatchGenerate,
        },
        {
            key: "duplicate",
            label: "批量复制",
            icon: <Copy className="size-3.5" />,
            onClick: handleBatchDuplicate,
        },
        {
            key: "settings",
            label: "批量设置",
            icon: <Settings className="size-3.5" />,
            onClick: handleBatchSettings,
        },
        {
            type: "divider" as const,
        },
        {
            key: "delete",
            label: "批量删除",
            icon: <Trash2 className="size-3.5" />,
            danger: true,
            onClick: handleBatchDelete,
        },
    ];

    if (selectedScenes.length === 0) {
        return null;
    }

    return (
        <>
            <div className="fixed bottom-6 right-6 z-50">
                <Space.Compact className="bg-background border border-border rounded-lg shadow-lg p-2">
                    <div className="flex items-center gap-2 px-3">
                        <span className="text-sm font-medium">
                            已选择 {selectedScenes.length} 个场景
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {totalShots} 镜头 · {totalDuration}s
                        </span>
                    </div>
                    <Button type="primary" icon={<Play className="size-4" />} onClick={handleBatchGenerate} disabled={disabled}>
                        批量生成
                    </Button>
                    <Dropdown menu={{ items: menuItems }} trigger={["click"]} disabled={disabled}>
                        <Button icon={<MoreVertical className="size-4" />} />
                    </Dropdown>
                </Space.Compact>
            </div>

            <Modal
                title="批量场景设置"
                open={showSettingsModal}
                onOk={applyBatchSettings}
                onCancel={() => {
                    setShowSettingsModal(false);
                    setBatchSettings({});
                }}
                okText="应用设置"
                cancelText="取消"
            >
                <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                        将以下设置应用到选中的 {selectedScenes.length} 个场景
                    </p>
                    {/* Batch settings form would go here */}
                    <div className="text-xs text-muted-foreground">
                        批量设置功能即将推出，包括：地点、时段、天气、光线等统一设置
                    </div>
                </div>
            </Modal>
        </>
    );
}
