"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { FileText } from "lucide-react";

// 动态导入避免 SSR 问题
const CanvasScriptNodeLazy = dynamic(
    () => import("./canvas-script-node").then((mod) => ({ default: mod.CanvasScriptNode })),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <FileText className="size-8 mx-auto mb-2 text-gray-400" />
                    <div className="text-xs text-gray-500">加载脚本编辑器...</div>
                </div>
            </div>
        ),
    }
);

type CanvasScriptNodeWrapperProps = {
    node: any;
    theme: any;
};

/**
 * Script 节点内容包装器
 * 用于在画布中渲染 Script 节点
 */
export function CanvasScriptNodeWrapper({ node }: CanvasScriptNodeWrapperProps) {
    const params = useParams();
    const projectId = params.id as string;

    if (!projectId || !node.metadata?.scriptId) {
        return (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
                <div className="text-center">
                    <FileText className="size-8 mx-auto mb-2" />
                    <div className="text-xs">脚本配置错误</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full">
            <CanvasScriptNodeLazy node={node} projectId={projectId} />
        </div>
    );
}
