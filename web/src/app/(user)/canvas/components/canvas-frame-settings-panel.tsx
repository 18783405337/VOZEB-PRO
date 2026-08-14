"use client";

import { useState } from "react";
import { Button, Input, Select, Switch } from "antd";
import { Check, LayoutGrid, Palette } from "lucide-react";

import type { CanvasNodeData } from "../types";
import { FRAME_COLORS, type FrameColorKey } from "../frame-types";

type CanvasFrameSettingsPanelProps = {
    frame: CanvasNodeData;
    onUpdateTitle: (title: string) => void;
    onUpdateColor: (color: string) => void;
    onToggleTitleVisibility: () => void;
    onClose: () => void;
};

/**
 * Frame 节点设置面板
 */
export function CanvasFrameSettingsPanel({
    frame,
    onUpdateTitle,
    onUpdateColor,
    onToggleTitleVisibility,
    onClose,
}: CanvasFrameSettingsPanelProps) {
    const [title, setTitle] = useState(frame.title || "");
    const currentColor = frame.metadata?.frameColor || "blue";
    const showTitle = frame.metadata?.frameShowTitle ?? true;

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
    };

    const handleTitleBlur = () => {
        if (title !== frame.title) {
            onUpdateTitle(title);
        }
    };

    const handleColorChange = (color: string) => {
        onUpdateColor(color);
    };

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <LayoutGrid className="size-4" />
                    框架设置
                </div>
                <Button size="small" onClick={onClose}>
                    关闭
                </Button>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-600">标题</label>
                <Input
                    value={title}
                    onChange={handleTitleChange}
                    onBlur={handleTitleBlur}
                    placeholder="输入框架标题"
                    size="small"
                />
            </div>

            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">显示标题</label>
                <Switch size="small" checked={showTitle} onChange={onToggleTitleVisibility} />
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-600">颜色主题</label>
                <div className="grid grid-cols-4 gap-2">
                    {Object.entries(FRAME_COLORS).map(([key, value]) => (
                        <button
                            key={key}
                            type="button"
                            className="group relative flex h-10 items-center justify-center rounded-md border-2 transition-all hover:scale-105"
                            style={{
                                borderColor: currentColor === key ? value.border : "transparent",
                                backgroundColor: `${value.background}20`,
                            }}
                            onClick={() => handleColorChange(key)}
                            title={value.name}
                        >
                            <div
                                className="h-6 w-6 rounded-full"
                                style={{ backgroundColor: value.border }}
                            />
                            {currentColor === key && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Check className="size-4 text-white drop-shadow-lg" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                <div className="font-medium">框架说明</div>
                <div>• 拖动节点到框架内可自动分组</div>
                <div>• 移动框架时子节点会一起移动</div>
                <div>• 调整框架大小以容纳更多内容</div>
            </div>
        </div>
    );
}
