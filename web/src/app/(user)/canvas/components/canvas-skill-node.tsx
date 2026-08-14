"use client";

import React, { useState, useCallback } from "react";
import { Wand2, Play, X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { SkillTemplate, SkillParameter, SkillInstanceData } from "../skill-types";

type CanvasSkillNodeProps = {
    node: any;
    projectId: string;
};

/**
 * Skill 节点核心组件
 * 显示技能参数配置和执行界面
 */
export function CanvasSkillNode({ node, projectId }: CanvasSkillNodeProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const skillData = node.metadata as SkillInstanceData | undefined;
    const templateId = skillData?.templateId || "unknown";
    const status = skillData?.status || "idle";
    const progress = skillData?.progress || 0;

    const handleExecute = useCallback(async () => {
        if (!node.metadata?.skillId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/canvas/${projectId}/skills/${node.metadata.skillId}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    parameters: skillData?.parameters || {},
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "执行失败");
            }

            // 执行成功，刷新节点数据
            window.location.reload();
        } catch (err) {
            setError(err instanceof Error ? err.message : "执行失败");
        } finally {
            setLoading(false);
        }
    }, [projectId, node.metadata?.skillId, skillData?.parameters]);

    const getStatusIcon = () => {
        switch (status) {
            case "running":
                return <Loader2 className="size-4 animate-spin text-blue-500" />;
            case "success":
                return <CheckCircle2 className="size-4 text-green-500" />;
            case "error":
                return <AlertCircle className="size-4 text-red-500" />;
            default:
                return <Wand2 className="size-4 text-gray-400" />;
        }
    };

    const getStatusText = () => {
        switch (status) {
            case "running":
                return `执行中 ${progress}%`;
            case "success":
                return "执行成功";
            case "error":
                return "执行失败";
            default:
                return "等待执行";
        }
    };

    return (
        <div className="flex h-full w-full flex-col p-4">
            {/* 头部 */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    {templateId}
                </span>
            </div>

            {/* 进度条 */}
            {status === "running" && (
                <div className="mb-4">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* 参数显示 */}
            <div className="thin-scrollbar mb-4 flex-1 space-y-2 overflow-y-auto text-xs text-gray-600">
                {skillData?.parameters && Object.keys(skillData.parameters).length > 0 ? (
                    Object.entries(skillData.parameters).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                            <span className="font-medium">{key}:</span>
                            <span className="text-gray-500">{String(value)}</span>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-gray-400">无参数</div>
                )}
            </div>

            {/* 错误信息 */}
            {(error || skillData?.error) && (
                <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-600">
                    {error || skillData?.error}
                </div>
            )}

            {/* 输出预览 */}
            {status === "success" && skillData?.output && (
                <div className="mb-3 rounded-md bg-green-50 p-2">
                    <div className="text-xs font-medium text-green-700">输出结果</div>
                    <div className="mt-1 text-xs text-green-600">
                        {skillData.output.mode === "inline" && (
                            <div className="max-h-20 overflow-y-auto">
                                {JSON.stringify(skillData.output.data, null, 2)}
                            </div>
                        )}
                        {skillData.output.mode === "node" && (
                            <div>已创建节点: {skillData.output.nodeId}</div>
                        )}
                        {skillData.output.mode === "download" && (
                            <a
                                href={skillData.output.downloadUrl}
                                className="text-blue-600 hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                下载文件
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* 执行按钮 */}
            <button
                type="button"
                onClick={handleExecute}
                disabled={loading || status === "running"}
                className="flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-500 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading || status === "running" ? (
                    <>
                        <Loader2 className="size-4 animate-spin" />
                        执行中...
                    </>
                ) : (
                    <>
                        <Play className="size-4" />
                        执行技能
                    </>
                )}
            </button>

            {/* 最后执行时间 */}
            {skillData?.lastExecutedAt && (
                <div className="mt-2 text-center text-xs text-gray-400">
                    最后执行: {new Date(skillData.lastExecutedAt).toLocaleString("zh-CN")}
                </div>
            )}
        </div>
    );
}
