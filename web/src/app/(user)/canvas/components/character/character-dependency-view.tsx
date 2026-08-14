"use client";

import React from "react";
import { AlertTriangle, CheckCircle, Film, Link, Zap } from "lucide-react";
import type { CharacterDependency } from "../../character-reference-types";

type CharacterDependencyViewProps = {
    dependency: CharacterDependency;
    onNodeClick?: (nodeId: string) => void;
    onShotClick?: (shotId: string) => void;
};

/**
 * 角色依赖追踪组件
 * 显示角色被哪些节点、镜头和任务使用
 */
export function CharacterDependencyView({
    dependency,
    onNodeClick,
    onShotClick,
}: CharacterDependencyViewProps) {
    const totalDependencies =
        dependency.dependencies.storyboardNodes.length +
        dependency.dependencies.shots.length +
        dependency.dependencies.generationTasks.length;

    return (
        <div className="space-y-4">
            {/* 状态头部 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                    {dependency.canDelete ? (
                        <CheckCircle className="size-5 text-green-500" />
                    ) : (
                        <AlertTriangle className="size-5 text-amber-500" />
                    )}
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">
                            {dependency.characterName}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                            {dependency.canDelete
                                ? "此角色可以安全删除"
                                : "此角色正在被使用，删除前请先解除依赖"}
                        </p>
                        {dependency.deleteImpact && (
                            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                                {dependency.deleteImpact}
                            </p>
                        )}
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                            {totalDependencies}
                        </div>
                        <div className="text-xs text-gray-500">依赖项</div>
                    </div>
                </div>
            </div>

            {/* 分镜节点依赖 */}
            {dependency.dependencies.storyboardNodes.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Film className="size-4 text-blue-500" />
                        <h4 className="text-sm font-medium text-gray-700">
                            分镜节点 ({dependency.dependencies.storyboardNodes.length})
                        </h4>
                    </div>
                    <div className="space-y-2">
                        {dependency.dependencies.storyboardNodes.map((node) => (
                            <button
                                key={node.nodeId}
                                type="button"
                                onClick={() => onNodeClick?.(node.nodeId)}
                                className="flex w-full items-center justify-between rounded-lg border border-gray-100 p-2 text-left hover:bg-gray-50"
                            >
                                <div className="text-xs font-medium text-gray-700">
                                    {node.nodeTitle}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {node.shotCount} 镜头
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 镜头依赖 */}
            {dependency.dependencies.shots.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Link className="size-4 text-purple-500" />
                        <h4 className="text-sm font-medium text-gray-700">
                            镜头引用 ({dependency.dependencies.shots.length})
                        </h4>
                    </div>
                    <div className="max-h-48 space-y-1 overflow-auto">
                        {dependency.dependencies.shots.map((shot) => (
                            <button
                                key={shot.shotId}
                                type="button"
                                onClick={() => onShotClick?.(shot.shotId)}
                                className="flex w-full items-center gap-2 rounded p-2 text-left hover:bg-gray-50"
                            >
                                <div className="flex size-7 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600">
                                    {shot.shotNumber}
                                </div>
                                <div className="flex-1 text-xs text-gray-600">
                                    镜头 #{shot.shotNumber}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 生成任务依赖 */}
            {dependency.dependencies.generationTasks.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Zap className="size-4 text-yellow-500" />
                        <h4 className="text-sm font-medium text-gray-700">
                            生成任务 ({dependency.dependencies.generationTasks.length})
                        </h4>
                    </div>
                    <div className="space-y-2">
                        {dependency.dependencies.generationTasks.map((task) => (
                            <div
                                key={task.taskId}
                                className="flex items-center justify-between rounded-lg border border-gray-100 p-2"
                            >
                                <div className="text-xs text-gray-600">
                                    任务 {task.taskId.slice(0, 8)}...
                                </div>
                                <div
                                    className={`rounded px-2 py-0.5 text-xs ${
                                        task.status === "completed"
                                            ? "bg-green-100 text-green-700"
                                            : task.status === "failed"
                                              ? "bg-red-100 text-red-700"
                                              : task.status === "running"
                                                ? "bg-blue-100 text-blue-700"
                                                : "bg-gray-100 text-gray-700"
                                    }`}
                                >
                                    {task.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
