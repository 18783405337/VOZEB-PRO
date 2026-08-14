"use client";

import React from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { StoryboardScene, StoryboardShot } from "../../storyboard-types";
import { calculateSceneDuration } from "../../storyboard-types";

type StoryboardScenePanelProps = {
    scenes: StoryboardScene[];
    shots: StoryboardShot[];
    onAddScene: () => void;
    onUpdateScene: (sceneId: string, updates: Partial<StoryboardScene>) => void;
    onDeleteScene: (sceneId: string) => void;
    onAddShot: (sceneId: string) => void;
};

/**
 * 场景面板组件 - 左侧场景列表
 */
export function StoryboardScenePanel({
    scenes,
    shots,
    onAddScene,
    onUpdateScene,
    onDeleteScene,
    onAddShot,
}: StoryboardScenePanelProps) {
    return (
        <div className="flex h-full flex-col">
            {/* 标题 */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-xs font-medium text-gray-700">场景列表</span>
                <button
                    type="button"
                    onClick={onAddScene}
                    className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                    title="添加场景"
                >
                    <Plus className="size-3.5" />
                </button>
            </div>

            {/* 场景列表 */}
            <div className="thin-scrollbar flex-1 overflow-y-auto">
                {scenes.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-xs text-gray-400">
                        暂无场景
                    </div>
                ) : (
                    <div className="space-y-1 p-2">
                        {scenes.map((scene) => {
                            const sceneShots = shots.filter(s => s.sceneId === scene.id);
                            const duration = calculateSceneDuration(scene, shots);
                            const isCollapsed = scene.collapsed ?? false;

                            return (
                                <div
                                    key={scene.id}
                                    className="rounded border border-gray-200 bg-white"
                                >
                                    {/* 场景头部 */}
                                    <div className="flex items-center gap-2 p-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onUpdateScene(scene.id, {
                                                    collapsed: !isCollapsed,
                                                })
                                            }
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            {isCollapsed ? (
                                                <ChevronRight className="size-3" />
                                            ) : (
                                                <ChevronDown className="size-3" />
                                            )}
                                        </button>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={scene.title}
                                                    onChange={(e) =>
                                                        onUpdateScene(scene.id, {
                                                            title: e.target.value,
                                                        })
                                                    }
                                                    className="w-full border-none bg-transparent px-0 text-xs font-medium text-gray-800 focus:outline-none focus:ring-0"
                                                    placeholder="场景标题"
                                                />
                                                {scene.color && (
                                                    <div
                                                        className="size-3 rounded-full"
                                                        style={{ backgroundColor: scene.color }}
                                                    />
                                                )}
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                                                <span>{sceneShots.length} 镜头</span>
                                                <span>·</span>
                                                <span>{duration.toFixed(1)}s</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => onAddShot(scene.id)}
                                                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                                title="添加镜头"
                                            >
                                                <Plus className="size-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDeleteScene(scene.id)}
                                                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                                title="删除场景"
                                            >
                                                <Trash2 className="size-3" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 场景详情（展开时显示） */}
                                    {!isCollapsed && (
                                        <div className="border-t border-gray-100 p-2 text-xs">
                                            <div className="space-y-1.5">
                                                {scene.location && (
                                                    <div className="text-gray-600">
                                                        <span className="font-medium">地点: </span>
                                                        {scene.location}
                                                    </div>
                                                )}
                                                {scene.timeOfDay && (
                                                    <div className="text-gray-600">
                                                        <span className="font-medium">时间: </span>
                                                        {scene.timeOfDay}
                                                    </div>
                                                )}
                                                {scene.description && (
                                                    <div className="text-gray-500">
                                                        {scene.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
