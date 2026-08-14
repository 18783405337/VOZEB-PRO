"use client";

import React, { useMemo } from "react";
import { BarChart3, Clock, Film, TrendingUp } from "lucide-react";
import type { CharacterUsageStats } from "../../character-reference-types";
import { getCharacterRoleLabel, getCharacterRoleColor } from "../../character-reference-types";

type CharacterUsageStatsViewProps = {
    stats: CharacterUsageStats;
    onShotClick?: (shotId: string) => void;
    onSceneClick?: (sceneId: string) => void;
};

/**
 * 角色使用统计视图组件
 * 显示角色在分镜中的使用情况和统计信息
 */
export function CharacterUsageStatsView({
    stats,
    onShotClick,
    onSceneClick,
}: CharacterUsageStatsViewProps) {
    // 计算角色分布
    const roleDistribution = useMemo(() => {
        const total = stats.totalShots;
        return [
            {
                role: "primary" as const,
                count: stats.primaryShots,
                percentage: total > 0 ? (stats.primaryShots / total) * 100 : 0,
            },
            {
                role: "secondary" as const,
                count: stats.secondaryShots,
                percentage: total > 0 ? (stats.secondaryShots / total) * 100 : 0,
            },
            {
                role: "background" as const,
                count: stats.backgroundShots,
                percentage: total > 0 ? (stats.backgroundShots / total) * 100 : 0,
            },
        ];
    }, [stats]);

    // 格式化时长
    const formatDuration = (seconds?: number) => {
        if (!seconds) return "-";
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="space-y-4">
            {/* 概览卡片 */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {/* 总镜头数 */}
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                        <Film className="size-4 text-blue-500" />
                        <span className="text-xs text-gray-500">总镜头数</span>
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">
                        {stats.totalShots}
                    </div>
                </div>

                {/* 主要角色镜头 */}
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="size-4 text-blue-500" />
                        <span className="text-xs text-gray-500">主要镜头</span>
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">
                        {stats.primaryShots}
                    </div>
                </div>

                {/* 总出镜时长 */}
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                        <Clock className="size-4 text-green-500" />
                        <span className="text-xs text-gray-500">出镜时长</span>
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">
                        {formatDuration(stats.totalDuration)}
                    </div>
                </div>

                {/* 占比 */}
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="size-4 text-purple-500" />
                        <span className="text-xs text-gray-500">占比</span>
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">
                        {stats.screenTimePercentage?.toFixed(1) || "-"}%
                    </div>
                </div>
            </div>

            {/* 角色分布 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-medium text-gray-700">角色分布</h3>
                <div className="space-y-3">
                    {roleDistribution.map(({ role, count, percentage }) => (
                        <div key={role}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="font-medium text-gray-700">
                                    {getCharacterRoleLabel(role)}
                                </span>
                                <span className="text-gray-500">
                                    {count} 镜头 ({percentage.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: getCharacterRoleColor(role),
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 出现的场景 */}
            {stats.scenes.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-medium text-gray-700">
                        出现的场景 ({stats.scenes.length})
                    </h3>
                    <div className="space-y-2">
                        {stats.scenes.map((scene) => (
                            <button
                                key={scene.sceneId}
                                type="button"
                                onClick={() => onSceneClick?.(scene.sceneId)}
                                className="flex w-full items-center justify-between rounded-lg border border-gray-100 p-2 text-left hover:bg-gray-50"
                            >
                                <div>
                                    <div className="text-xs font-medium text-gray-700">
                                        场景 {scene.sceneNumber}: {scene.sceneTitle}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                    {scene.shotCount} 镜头
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 出现的镜头列表 */}
            {stats.shots.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-medium text-gray-700">
                        镜头列表 ({stats.shots.length})
                    </h3>
                    <div className="max-h-64 space-y-1 overflow-auto">
                        {stats.shots.map((shot) => (
                            <button
                                key={shot.shotId}
                                type="button"
                                onClick={() => onShotClick?.(shot.shotId)}
                                className="flex w-full items-center gap-2 rounded p-2 text-left hover:bg-gray-50"
                            >
                                <div className="flex size-8 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600">
                                    {shot.shotNumber}
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs text-gray-500">
                                        镜头 #{shot.globalOrder}
                                    </div>
                                </div>
                                <div
                                    className="rounded px-2 py-0.5 text-xs text-white"
                                    style={{
                                        backgroundColor: getCharacterRoleColor(shot.roleInShot),
                                    }}
                                >
                                    {getCharacterRoleLabel(shot.roleInShot)}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
