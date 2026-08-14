"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { PenTool } from "lucide-react";

// 动态导入避免 SSR 问题
const CanvasDrawingNodeLazy = dynamic(
    () => import("./canvas-drawing-node").then((mod) => ({ default: mod.CanvasDrawingNode })),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <PenTool className="size-8 mx-auto mb-2 text-gray-400" />
                    <div className="text-xs text-gray-500">加载绘图编辑器...</div>
                </div>
            </div>
        ),
    }
);

type CanvasDrawingNodeWrapperProps = {
    node: any;
    theme: any;
};

/**
 * Drawing 节点内容包装器
 * 用于在画布中渲染 Drawing 节点
 */
export function CanvasDrawingNodeWrapper({ node }: CanvasDrawingNodeWrapperProps) {
    const params = useParams();
    const projectId = params.id as string;

    if (!projectId || !node.metadata?.drawingId) {
        return (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
                <div className="text-center">
                    <PenTool className="size-8 mx-auto mb-2" />
                    <div className="text-xs">绘图配置错误</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full">
            <CanvasDrawingNodeLazy node={node} projectId={projectId} />
        </div>
    );
}
