"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { CanvasNodeData } from "../../types";

const CanvasStoryboardNode = dynamic(
    () =>
        import("./canvas-storyboard-node").then((mod) => ({
            default: mod.CanvasStoryboardNode,
        })),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
                <div className="text-xs">加载中...</div>
            </div>
        ),
    }
);

type CanvasStoryboardNodeWrapperProps = {
    node: CanvasNodeData;
    projectId: string;
};

/**
 * Storyboard 节点包装器
 * 负责动态加载和错误边界
 */
export function CanvasStoryboardNodeWrapper({ node, projectId }: CanvasStoryboardNodeWrapperProps) {
    return <CanvasStoryboardNode node={node} projectId={projectId} />;
}
