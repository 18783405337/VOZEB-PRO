"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Wand2 } from "lucide-react";

// 动态导入避免 SSR 问题
const CanvasSkillNodeLazy = dynamic(
    () => import("./canvas-skill-node").then((mod) => ({ default: mod.CanvasSkillNode })),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <Wand2 className="size-8 mx-auto mb-2 text-gray-400" />
                    <div className="text-xs text-gray-500">加载技能编辑器...</div>
                </div>
            </div>
        ),
    }
);

type CanvasSkillNodeWrapperProps = {
    node: any;
    theme: any;
};

/**
 * Skill 节点内容包装器
 * 用于在画布中渲染 Skill 节点
 */
export function CanvasSkillNodeWrapper({ node }: CanvasSkillNodeWrapperProps) {
    const params = useParams();
    const projectId = params.id as string;

    if (!projectId || !node.metadata?.skillId) {
        return (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
                <div className="text-center">
                    <Wand2 className="size-8 mx-auto mb-2" />
                    <div className="text-xs">技能配置错误</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full">
            <CanvasSkillNodeLazy node={node} projectId={projectId} />
        </div>
    );
}
