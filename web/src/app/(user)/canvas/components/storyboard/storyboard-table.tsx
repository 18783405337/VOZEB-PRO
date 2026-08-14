"use client";

import React, { useMemo } from "react";
import { Trash2, Plus } from "lucide-react";
import type { StoryboardData, StoryboardShot } from "../../storyboard-types";
import {
    getShotTypeLabel,
    getCameraAngleLabel,
    getCameraMovementLabel,
    getTransitionTypeLabel,
    getShotStatusInfo,
    getShotPriorityInfo,
    STORYBOARD_COLUMNS,
} from "../../storyboard-types";

type StoryboardTableProps = {
    data: StoryboardData;
    onUpdateShot: (shotId: string, updates: Partial<StoryboardShot>) => void;
    onDeleteShot: (shotId: string) => void;
    onAddShot: (sceneId: string) => void;
};

/**
 * 分镜表格编辑器组件
 */
export function StoryboardTable({
    data,
    onUpdateShot,
    onDeleteShot,
    onAddShot,
}: StoryboardTableProps) {
    // 按场景和镜头顺序排列
    const sortedShots = useMemo(() => {
        return data.shots.sort((a, b) => a.globalOrder - b.globalOrder);
    }, [data.shots]);

    // 获取场景信息
    const getSceneForShot = (shot: StoryboardShot) => {
        return data.scenes.find(s => s.id === shot.sceneId);
    };

    return (
        <div className="flex h-full flex-col">
            {/* 表格容器 */}
            <div className="thin-scrollbar flex-1 overflow-auto">
                <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-50">
                        <tr className="border-b border-gray-200">
                            <th className="w-10 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                #
                            </th>
                            <th className="w-12 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                场次
                            </th>
                            <th className="w-32 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                缩略图
                            </th>
                            <th className="w-32 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                景别
                            </th>
                            <th className="w-32 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                机位
                            </th>
                            <th className="w-32 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                运镜
                            </th>
                            <th className="min-w-48 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                画面描述
                            </th>
                            <th className="w-32 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                对白
                            </th>
                            <th className="w-24 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                时长(秒)
                            </th>
                            <th className="w-28 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                转场
                            </th>
                            <th className="w-28 border-r border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                                状态
                            </th>
                            <th className="w-16 border-r border-gray-200 px-2 py-2 text-center font-medium text-gray-700">
                                操作
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedShots.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={12}
                                    className="py-8 text-center text-gray-400"
                                >
                                    暂无镜头数据
                                </td>
                            </tr>
                        ) : (
                            sortedShots.map((shot) => {
                                const scene = getSceneForShot(shot);
                                const statusInfo = getShotStatusInfo(shot.status);

                                return (
                                    <tr
                                        key={shot.id}
                                        className="border-b border-gray-100 hover:bg-gray-50"
                                    >
                                        {/* 镜号 */}
                                        <td className="border-r border-gray-100 px-2 py-2 text-gray-600">
                                            {shot.globalOrder}
                                        </td>

                                        {/* 场次 */}
                                        <td className="border-r border-gray-100 px-2 py-2 text-gray-600">
                                            {scene?.sceneNumber || "-"}
                                        </td>

                                        {/* 缩略图 */}
                                        <td className="border-r border-gray-100 px-2 py-2">
                                            {shot.imageUrl ? (
                                                <img
                                                    src={shot.imageUrl}
                                                    alt={`镜头 ${shot.shotNumber}`}
                                                    className="h-16 w-28 rounded border border-gray-200 object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-16 w-28 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                                                    无图片
                                                </div>
                                            )}
                                        </td>

                                        {/* 景别 */}
                                        <td className="border-r border-gray-100 px-2 py-2">
                                            <select
                                                value={shot.shotType}
                                                onChange={(e) =>
                                                    onUpdateShot(shot.id, {
                                                        shotType: e.target.value as any,
                                                    })
                                                }
                                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="extreme-wide">大远景</option>
                                                <option value="wide">远景</option>
                                                <option value="full">全景</option>
                                                <option value="medium">中景</option>
                                                <option value="close-up">近景</option>
                                                <option value="extreme-close-up">特写</option>
                                                <option value="over-shoulder">过肩</option>
                                                <option value="two-shot">双人</option>
                                            </select>
                                        </td>

                                        {/* 机位 */}
                                        <td className="border-r border-gray-100 px-2 py-2">
                                            <select
                                                value={shot.cameraAngle}
                                                onChange={(e) =>
                                                    onUpdateShot(shot.id, {
                                                        cameraAngle: e.target.value as any,
                                                    })
                                                }
                                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="eye-level">平视</option>
                                                <option value="high">俯视</option>
                                                <option value="low">仰视</option>
                                                <option value="overhead">顶视</option>
                                                <option value="dutch">荷兰角</option>
                                                <option value="pov">主观视角</option>
                                            </select>
                                        </td>

                                        {/* 运镜 */}
                                        <td className="border-r border-gray-100 px-2 py-2">
                                            <select
                                                value={shot.cameraMovement}
                                                onChange={(e) =>
                                                    onUpdateShot(shot.id, {
                                                        cameraMovement: e.target.value as any,
                                                    })
                                                }
                                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="static">静止</option>
                                                <option value="pan">摇镜</option>
                                                <option value="tilt">倾斜</option>
                                                <option value="dolly">推拉</option>
                                                <option value="track">跟踪</option>
                                                <option value="crane">升降</option>
                                                <option value="handheld">手持</option>
                                                <option value="zoom">变焦</option>
                                                <option value="steadicam">斯坦尼康</option>
                                            </select>
                                        </td>

                                        {/* 画面描述 */}
                                        <td className="border-r border-gray-100 px-2 py-2">
                                            <textarea
                                                value={shot.description}
                                                onChange={(e) =>
                                                    onUpdateShot(shot.id, {
                                                        description: e.target.value,
                                                    })
                                                }
                                                rows={2}
                                                className="w-full resize-none rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                                placeholder="输入画面描述..."
                                            />
                                        </td>

                                        {/* 对白 */}
                                        <td className="border-r border-gray-100 px-2 py-2">
                                            <textarea
                                                value={shot.dialogue || ""}
                                                onChange={(e) =>
                                                    onUpdateShot(shot.id, {
                                                        dialogue: e.target.value,
                                                    })
                                                }
                                                rows={2}
                                                className="w-full resize-none rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                                placeholder="输入对白..."
                                            />
                                        </td>

                                        {/* 时长 */}
                                        <td className="border-r border-gray-100 px-2 py-2">
                                            <input
                                                type="number"
                                                value={shot.duration}
                                                onChange={(e) =>
                                                    onUpdateShot(shot.id, {
                                                        duration: parseFloat(e.target.value) || 0,
                                                    })
                                                }
                                                min={0}
                                                step={0.1}
                                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                            />
                                        </td>

                                        {/* 转场 */}
                                        <td className="border-r border-gray-100 px-2 py-2">
                                            <select
                                                value={shot.transition}
                                                onChange={(e) =>
                                                    onUpdateShot(shot.id, {
                                                        transition: e.target.value as any,
                                                    })
                                                }
                                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="cut">切</option>
                                                <option value="fade">淡入淡出</option>
                                                <option value="dissolve">叠化</option>
                                                <option value="wipe">划像</option>
                                                <option value="match-cut">匹配剪辑</option>
                                            </select>
                                        </td>

                                        {/* 状态 */}
                                        <td className="border-r border-gray-100 px-2 py-2">
                                            <span
                                                className="inline-block rounded-full px-2 py-0.5 text-xs text-white"
                                                style={{ backgroundColor: statusInfo.color }}
                                            >
                                                {statusInfo.label}
                                            </span>
                                        </td>

                                        {/* 操作 */}
                                        <td className="border-r border-gray-100 px-2 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => onDeleteShot(shot.id)}
                                                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                                title="删除镜头"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
