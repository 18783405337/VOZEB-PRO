"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Film, Plus, Trash2, AlertCircle, Loader2, Table as TableIcon } from "lucide-react";
import type { StoryboardData, StoryboardScene, StoryboardShot } from "../../storyboard-types";
import { createDefaultScene, createDefaultShot, calculateTotalDuration } from "../../storyboard-types";
import { StoryboardTable } from "./storyboard-table";
import { StoryboardScenePanel } from "./storyboard-scene-panel";
import { saveStoryboardToLocal, loadStoryboardFromLocal } from "../../utils/canvas-storyboard-storage";

type CanvasStoryboardNodeProps = {
    node: any;
    projectId: string;
};

/**
 * Storyboard 节点主组件
 */
export function CanvasStoryboardNode({ node, projectId }: CanvasStoryboardNodeProps) {
    const storyboardId = node.metadata?.storyboardId;
    const [data, setData] = useState<StoryboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<"table" | "timeline">("table");
    const saveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const AUTO_SAVE_DELAY = 2000;

    // 加载分镜数据
    useEffect(() => {
        async function loadStoryboard() {
            if (!storyboardId) {
                setError("分镜 ID 未配置");
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                // 首先尝试从本地加载
                const localData = await loadStoryboardFromLocal({ projectId, storyboardId });
                if (localData) {
                    setData(localData);
                    setIsLoading(false);
                    return;
                }

                // 从服务器加载
                const response = await fetch(`/api/canvas/${projectId}/storyboard/${storyboardId}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.code === 0 && result.data) {
                        setData(result.data);
                        // 保存到本地缓存
                        await saveStoryboardToLocal({ projectId, storyboardId }, result.data);
                    }
                } else if (response.status === 404) {
                    // 文档不存在，创建新文档
                    const now = new Date().toISOString();
                    const defaultScene = createDefaultScene(1);
                    const defaultShot = createDefaultShot(defaultScene.id, 1, 1);
                    defaultScene.shotIds.push(defaultShot.id);

                    const newData: StoryboardData = {
                        storyboardId,
                        projectId,
                        title: node.title || "新分镜脚本",
                        scenes: [defaultScene],
                        shots: [defaultShot],
                        revision: 0,
                        createdAt: now,
                        updatedAt: now,
                    };
                    setData(newData);
                    // 保存到本地
                    await saveStoryboardToLocal({ projectId, storyboardId }, newData);
                } else {
                    throw new Error("加载分镜失败");
                }
            } catch (err) {
                console.error("Failed to load storyboard:", err);
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }

        loadStoryboard();
    }, [projectId, storyboardId, node.title]);

    // 保存到服务器
    const saveToServer = useCallback(
        async (dataToSave: StoryboardData) => {
            if (!storyboardId) return;

            try {
                setIsSaving(true);
                setError(null);

                const updatedData = {
                    ...dataToSave,
                    updatedAt: new Date().toISOString(),
                    revision: dataToSave.revision + 1,
                };

                // 检查文档是否存在
                const checkResponse = await fetch(`/api/canvas/${projectId}/storyboard/${storyboardId}`);

                let response;
                if (checkResponse.status === 404) {
                    // 创建新文档
                    response = await fetch(`/api/canvas/${projectId}/storyboard`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(updatedData),
                    });
                } else {
                    // 更新现有文档
                    response = await fetch(`/api/canvas/${projectId}/storyboard/${storyboardId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(updatedData),
                    });
                }

                if (!response.ok) {
                    throw new Error("保存失败");
                }

                // 保存到本地缓存
                await saveStoryboardToLocal({ projectId, storyboardId }, updatedData);
                setData(updatedData);
            } catch (err) {
                console.error("Failed to save storyboard:", err);
                setError("保存失败");
            } finally {
                setIsSaving(false);
            }
        },
        [projectId, storyboardId]
    );

    // 数据变更处理
    const handleDataChange = useCallback(
        (newData: StoryboardData) => {
            setData(newData);

            // 取消之前的保存定时器
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            // 设置新的保存定时器
            saveTimerRef.current = setTimeout(() => {
                saveToServer(newData);
            }, AUTO_SAVE_DELAY);
        },
        [saveToServer]
    );

    // 添加场景
    const handleAddScene = useCallback(() => {
        if (!data) return;
        const newScene = createDefaultScene(data.scenes.length + 1);
        handleDataChange({
            ...data,
            scenes: [...data.scenes, newScene],
        });
    }, [data, handleDataChange]);

    // 添加镜头
    const handleAddShot = useCallback(
        (sceneId: string) => {
            if (!data) return;
            const scene = data.scenes.find(s => s.id === sceneId);
            if (!scene) return;

            const shotNumber = scene.shotIds.length + 1;
            const globalOrder = data.shots.length + 1;
            const newShot = createDefaultShot(sceneId, shotNumber, globalOrder);

            const updatedScene = {
                ...scene,
                shotIds: [...scene.shotIds, newShot.id],
            };

            handleDataChange({
                ...data,
                scenes: data.scenes.map(s => (s.id === sceneId ? updatedScene : s)),
                shots: [...data.shots, newShot],
            });
        },
        [data, handleDataChange]
    );

    // 更新镜头
    const handleUpdateShot = useCallback(
        (shotId: string, updates: Partial<StoryboardShot>) => {
            if (!data) return;
            handleDataChange({
                ...data,
                shots: data.shots.map(shot =>
                    shot.id === shotId
                        ? { ...shot, ...updates, updatedAt: new Date().toISOString() }
                        : shot
                ),
            });
        },
        [data, handleDataChange]
    );

    // 删除镜头
    const handleDeleteShot = useCallback(
        (shotId: string) => {
            if (!data) return;
            const shot = data.shots.find(s => s.id === shotId);
            if (!shot) return;

            const scene = data.scenes.find(s => s.id === shot.sceneId);
            if (!scene) return;

            const updatedScene = {
                ...scene,
                shotIds: scene.shotIds.filter(id => id !== shotId),
            };

            handleDataChange({
                ...data,
                scenes: data.scenes.map(s => (s.id === scene.id ? updatedScene : s)),
                shots: data.shots.filter(s => s.id !== shotId),
            });
        },
        [data, handleDataChange]
    );

    // 更新场景
    const handleUpdateScene = useCallback(
        (sceneId: string, updates: Partial<StoryboardScene>) => {
            if (!data) return;
            handleDataChange({
                ...data,
                scenes: data.scenes.map(scene =>
                    scene.id === sceneId
                        ? { ...scene, ...updates, updatedAt: new Date().toISOString() }
                        : scene
                ),
            });
        },
        [data, handleDataChange]
    );

    // 删除场景
    const handleDeleteScene = useCallback(
        (sceneId: string) => {
            if (!data) return;
            handleDataChange({
                ...data,
                scenes: data.scenes.filter(s => s.id !== sceneId),
                shots: data.shots.filter(s => s.sceneId !== sceneId),
            });
        },
        [data, handleDataChange]
    );

    // 清理定时器
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    if (!storyboardId) {
        return (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
                <div className="text-center">
                    <AlertCircle className="mx-auto mb-2 size-8" />
                    <div className="text-xs">分镜配置错误</div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <Film className="mx-auto mb-2 size-8 animate-pulse text-gray-400" />
                    <div className="text-xs text-gray-500">加载分镜编辑器...</div>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex h-full w-full items-center justify-center text-red-500">
                <div className="text-center">
                    <AlertCircle className="mx-auto mb-2 size-8" />
                    <div className="text-xs">{error}</div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const totalDuration = calculateTotalDuration(data.shots);

    return (
        <div className="flex h-full w-full flex-col bg-white">
            {/* 头部工具栏 */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
                <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>{data.scenes.length} 场景</span>
                    <span>{data.shots.length} 镜头</span>
                    <span>{totalDuration.toFixed(1)}s 总时长</span>
                </div>
                <div className="flex items-center gap-2">
                    {isSaving && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Loader2 className="size-3 animate-spin" />
                            <span>保存中...</span>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-1 text-xs text-red-500">
                            <AlertCircle className="size-3" />
                            <span>{error}</span>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleAddScene}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    >
                        <Plus className="size-3" />
                        添加场景
                    </button>
                </div>
            </div>

            {/* 主内容区 */}
            <div className="flex flex-1 overflow-hidden">
                {/* 场景面板 */}
                <div className="w-64 border-r border-gray-200">
                    <StoryboardScenePanel
                        scenes={data.scenes}
                        shots={data.shots}
                        onAddScene={handleAddScene}
                        onUpdateScene={handleUpdateScene}
                        onDeleteScene={handleDeleteScene}
                        onAddShot={handleAddShot}
                    />
                </div>

                {/* 表格编辑器 */}
                <div className="flex-1 overflow-hidden">
                    <StoryboardTable
                        data={data}
                        onUpdateShot={handleUpdateShot}
                        onDeleteShot={handleDeleteShot}
                        onAddShot={handleAddShot}
                    />
                </div>
            </div>
        </div>
    );
}
