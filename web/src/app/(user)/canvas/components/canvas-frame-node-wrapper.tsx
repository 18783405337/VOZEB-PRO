"use client";

import { useParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";

import type { CanvasNodeData } from "../types";
import { DEFAULT_FRAME_STYLE, FRAME_COLORS, type FrameColorKey } from "../frame-types";

type CanvasFrameNodeWrapperProps = {
    node: CanvasNodeData;
    theme: any;
};

/**
 * Frame 节点内容包装器
 * 用于在画布中渲染 Frame 节点
 */
export function CanvasFrameNodeWrapper({ node, theme }: CanvasFrameNodeWrapperProps) {
    const params = useParams();
    const projectId = params.id as string;

    if (!projectId || !node.metadata?.frameId) {
        return (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
                <div className="text-center">
                    <LayoutGrid className="size-8 mx-auto mb-2" />
                    <div className="text-xs">框架配置错误</div>
                </div>
            </div>
        );
    }

    const frameColor = node.metadata.frameColor || "blue";
    const colorScheme = FRAME_COLORS[frameColor as FrameColorKey] || FRAME_COLORS.blue;
    const backgroundOpacity = node.metadata.frameBackgroundOpacity ?? DEFAULT_FRAME_STYLE.backgroundOpacity;
    const showTitle = node.metadata.frameShowTitle ?? true;
    const childCount = node.metadata.frameChildNodeIds?.length || 0;

    // 转换十六进制颜色为 RGB 并添加透明度
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const backgroundColor = hexToRgba(colorScheme.background, backgroundOpacity);

    return (
        <div
            className="relative h-full w-full rounded-lg border-2"
            style={{
                borderColor: colorScheme.border,
                backgroundColor: backgroundColor,
            }}
        >
            {showTitle && (
                <div
                    className="absolute left-4 top-3 flex items-center gap-2 text-sm font-semibold"
                    style={{ color: theme.node.text }}
                >
                    <LayoutGrid className="size-4" style={{ color: colorScheme.border }} />
                    <span>{node.title || "未命名框架"}</span>
                    {childCount > 0 && (
                        <span
                            className="ml-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                                backgroundColor: hexToRgba(colorScheme.border, 0.15),
                                color: colorScheme.border,
                            }}
                        >
                            {childCount} 个节点
                        </span>
                    )}
                </div>
            )}

            {childCount === 0 && (
                <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ color: theme.node.placeholder }}
                >
                    <div className="text-center">
                        <LayoutGrid className="size-8 mx-auto mb-2 opacity-40" />
                        <div className="text-xs opacity-60">拖动节点到此处进行分组</div>
                    </div>
                </div>
            )}
        </div>
    );
}
