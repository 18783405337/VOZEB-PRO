/**
 * Canvas Frame 节点工具函数
 */

import { nanoid } from "nanoid";
import type { CanvasNodeData, Position } from "../types";
import { CanvasNodeType } from "../types";
import type { CanvasFrameData } from "../frame-types";
import { DEFAULT_FRAME_CONFIG, DEFAULT_FRAME_STYLE } from "../frame-types";

/**
 * 创建新的 Frame 节点
 */
export function createFrameNode(
    position: Position,
    projectId: string,
    options?: {
        title?: string;
        width?: number;
        height?: number;
        color?: string;
    }
): CanvasNodeData {
    const frameId = nanoid();
    const now = new Date().toISOString();

    const frameData: CanvasFrameData = {
        frameId,
        projectId,
        title: options?.title || "新框架",
        color: options?.color || "blue",
        showTitle: true,
        childNodeIds: [],
        createdAt: now,
        updatedAt: now,
    };

    return {
        id: nanoid(),
        type: CanvasNodeType.Frame,
        title: frameData.title,
        position,
        width: options?.width || 400,
        height: options?.height || 300,
        metadata: {
            frameId: frameData.frameId,
            frameColor: frameData.color,
            frameBackgroundOpacity: DEFAULT_FRAME_STYLE.backgroundOpacity,
            frameShowTitle: frameData.showTitle,
            frameChildNodeIds: frameData.childNodeIds,
        },
    };
}

/**
 * 检查节点是否在框架内
 */
export function isNodeInsideFrame(node: CanvasNodeData, frame: CanvasNodeData): boolean {
    const padding = DEFAULT_FRAME_CONFIG.padding;

    const nodeLeft = node.position.x;
    const nodeRight = node.position.x + node.width;
    const nodeTop = node.position.y;
    const nodeBottom = node.position.y + node.height;

    const frameLeft = frame.position.x + padding;
    const frameRight = frame.position.x + frame.width - padding;
    const frameTop = frame.position.y + padding + 40; // 40px for title area
    const frameBottom = frame.position.y + frame.height - padding;

    return (
        nodeLeft >= frameLeft &&
        nodeRight <= frameRight &&
        nodeTop >= frameTop &&
        nodeBottom <= frameBottom
    );
}

/**
 * 检查两个矩形是否重叠（用于检测节点是否部分在框架内）
 */
export function isNodeOverlappingFrame(node: CanvasNodeData, frame: CanvasNodeData): boolean {
    const nodeLeft = node.position.x;
    const nodeRight = node.position.x + node.width;
    const nodeTop = node.position.y;
    const nodeBottom = node.position.y + node.height;

    const frameLeft = frame.position.x;
    const frameRight = frame.position.x + frame.width;
    const frameTop = frame.position.y;
    const frameBottom = frame.position.y + frame.height;

    return !(
        nodeRight < frameLeft ||
        nodeLeft > frameRight ||
        nodeBottom < frameTop ||
        nodeTop > frameBottom
    );
}

/**
 * 将节点添加到框架
 */
export function addNodeToFrame(frame: CanvasNodeData, nodeId: string): CanvasNodeData {
    const currentChildIds = frame.metadata?.frameChildNodeIds || [];

    if (currentChildIds.includes(nodeId)) {
        return frame;
    }

    return {
        ...frame,
        metadata: {
            ...frame.metadata,
            frameChildNodeIds: [...currentChildIds, nodeId],
        },
    };
}

/**
 * 从框架中移除节点
 */
export function removeNodeFromFrame(frame: CanvasNodeData, nodeId: string): CanvasNodeData {
    const currentChildIds = frame.metadata?.frameChildNodeIds || [];

    return {
        ...frame,
        metadata: {
            ...frame.metadata,
            frameChildNodeIds: currentChildIds.filter((id) => id !== nodeId),
        },
    };
}

/**
 * 更新框架大小以适应所有子节点
 */
export function autoResizeFrame(
    frame: CanvasNodeData,
    childNodes: CanvasNodeData[]
): CanvasNodeData {
    if (childNodes.length === 0) {
        return frame;
    }

    const padding = DEFAULT_FRAME_CONFIG.padding;
    const titleHeight = 40;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    childNodes.forEach((node) => {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + node.width);
        maxY = Math.max(maxY, node.position.y + node.height);
    });

    const newX = minX - padding;
    const newY = minY - padding - titleHeight;
    const newWidth = Math.max(
        maxX - minX + padding * 2,
        DEFAULT_FRAME_CONFIG.minWidth
    );
    const newHeight = Math.max(
        maxY - minY + padding * 2 + titleHeight,
        DEFAULT_FRAME_CONFIG.minHeight
    );

    return {
        ...frame,
        position: { x: newX, y: newY },
        width: newWidth,
        height: newHeight,
    };
}

/**
 * 获取框架内的所有子节点
 */
export function getFrameChildNodes(
    frame: CanvasNodeData,
    allNodes: CanvasNodeData[]
): CanvasNodeData[] {
    const childNodeIds = frame.metadata?.frameChildNodeIds || [];
    return allNodes.filter((node) => childNodeIds.includes(node.id));
}

/**
 * 更新框架标题
 */
export function updateFrameTitle(frame: CanvasNodeData, title: string): CanvasNodeData {
    return {
        ...frame,
        title,
    };
}

/**
 * 更新框架颜色
 */
export function updateFrameColor(frame: CanvasNodeData, color: string): CanvasNodeData {
    return {
        ...frame,
        metadata: {
            ...frame.metadata,
            frameColor: color,
        },
    };
}

/**
 * 切换框架标题显示
 */
export function toggleFrameTitleVisibility(frame: CanvasNodeData): CanvasNodeData {
    return {
        ...frame,
        metadata: {
            ...frame.metadata,
            frameShowTitle: !frame.metadata?.frameShowTitle,
        },
    };
}
