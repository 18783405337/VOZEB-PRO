"use client";

import { Badge, Button, Card, Dropdown, Input, Space, Tag, Tooltip } from "antd";
import { ChevronDown, ChevronRight, Clock, Copy, Film, GripVertical, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SceneGroup } from "@/lib/drama-scene-types";
import { sceneColorMap } from "@/lib/drama-scene-utils";
import type { DramaShot } from "@/lib/drama-project-contract";

interface DramaSceneCardProps {
    scene: SceneGroup;
    shots: DramaShot[];
    onToggleCollapse: (sceneId: string) => void;
    onUpdateScene: (sceneId: string, updates: Partial<SceneGroup>) => void;
    onDuplicate: (sceneId: string) => void;
    onDelete: (sceneId: string) => void;
    onShotClick?: (shotId: string) => void;
    draggableProps?: Record<string, unknown>;
    dragHandleProps?: Record<string, unknown>;
}

export function DramaSceneCard({
    scene,
    shots,
    onToggleCollapse,
    onUpdateScene,
    onDuplicate,
    onDelete,
    onShotClick,
    draggableProps,
    dragHandleProps,
}: DramaSceneCardProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(scene.name);

    const colorStyles = sceneColorMap[scene.color];
    const sceneDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
    const completedCount = shots.filter((shot) => shot.generationStatus === "success").length;
    const failedCount = shots.filter((shot) => shot.generationStatus === "error").length;

    const handleNameSave = () => {
        if (editedName.trim() && editedName !== scene.name) {
            onUpdateScene(scene.id, { name: editedName.trim() });
        }
        setIsEditingName(false);
    };

    const menuItems = [
        {
            key: "edit",
            label: "编辑信息",
            icon: <Pencil className="size-3.5" />,
            onClick: () => setIsEditingName(true),
        },
        {
            key: "duplicate",
            label: "复制场景",
            icon: <Copy className="size-3.5" />,
            onClick: () => onDuplicate(scene.id),
        },
        {
            type: "divider" as const,
        },
        {
            key: "delete",
            label: "删除场景",
            icon: <Trash2 className="size-3.5" />,
            danger: true,
            onClick: () => onDelete(scene.id),
        },
    ];

    return (
        <Card
            className={`mb-3 border-l-4 ${colorStyles.border} hover:shadow-md transition-shadow`}
            size="small"
            {...draggableProps}
        >
            <div className="flex items-center gap-2">
                <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
                    <GripVertical className="size-4 text-muted-foreground" />
                </div>

                <Button
                    type="text"
                    size="small"
                    icon={scene.collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                    onClick={() => onToggleCollapse(scene.id)}
                />

                <div className="flex-1 min-w-0">
                    {isEditingName ? (
                        <Input
                            size="small"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            onBlur={handleNameSave}
                            onPressEnter={handleNameSave}
                            autoFocus
                            className="max-w-xs"
                        />
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-base">{scene.name}</span>
                            <Tag color={scene.color} className="!m-0">
                                场景 {scene.order + 1}
                            </Tag>
                            {scene.location && (
                                <Tag className="!m-0" bordered={false}>
                                    {scene.location}
                                </Tag>
                            )}
                            {scene.timeOfDay && (
                                <Tag className="!m-0" bordered={false}>
                                    {scene.timeOfDay}
                                </Tag>
                            )}
                            {scene.weather && (
                                <Tag className="!m-0" bordered={false}>
                                    {scene.weather}
                                </Tag>
                            )}
                        </div>
                    )}
                    {scene.description && !scene.collapsed && (
                        <p className="text-xs text-muted-foreground mt-1 mb-0">{scene.description}</p>
                    )}
                </div>

                <Space size="small" className="shrink-0">
                    <Tooltip title={`${sceneDuration}秒`}>
                        <Badge count={sceneDuration} showZero overflowCount={999} color="blue">
                            <Clock className="size-4 text-muted-foreground" />
                        </Badge>
                    </Tooltip>
                    <Tooltip title={`${shots.length}个镜头`}>
                        <Badge count={shots.length} showZero overflowCount={999} color="green">
                            <Film className="size-4 text-muted-foreground" />
                        </Badge>
                    </Tooltip>
                    {completedCount > 0 && (
                        <Tag color="success" className="!m-0">
                            完成 {completedCount}
                        </Tag>
                    )}
                    {failedCount > 0 && (
                        <Tag color="error" className="!m-0">
                            失败 {failedCount}
                        </Tag>
                    )}
                    <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                        <Button type="text" size="small" icon={<MoreVertical className="size-4" />} />
                    </Dropdown>
                </Space>
            </div>

            {!scene.collapsed && shots.length > 0 && (
                <div className="mt-3 pl-6">
                    <div className="space-y-1.5">
                        {shots.map((shot) => (
                            <div
                                key={shot.id}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => onShotClick?.(shot.id)}
                            >
                                <Badge
                                    status={
                                        shot.generationStatus === "success"
                                            ? "success"
                                            : shot.generationStatus === "error"
                                              ? "error"
                                              : shot.generationStatus === "running"
                                                ? "processing"
                                                : "default"
                                    }
                                />
                                <span className="text-xs font-medium text-muted-foreground">#{shot.order}</span>
                                <span className="text-sm flex-1 min-w-0 truncate">{shot.title}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{shot.duration}s</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {scene.transition && (
                <div className="mt-2 pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground">
                        转场: {scene.transition.type}
                        {scene.transition.duration > 0 && ` (${scene.transition.duration}s)`}
                        {scene.transition.description && ` - ${scene.transition.description}`}
                    </div>
                </div>
            )}
        </Card>
    );
}
