/**
 * Canvas Director 3D Node Component
 *
 * 3D导演台节点组件 - MVP版本
 * 提供基础3D场景预览和相机可视化
 */

"use client";

import { useState, useEffect, useRef, Suspense, lazy } from "react";
import type { CanvasNodeData } from "../types";
import type { Scene3DSnapshot } from "../types-director3d";
import { createDefaultSceneSnapshot } from "../utils/canvas-director3d-utils";

// 动态导入Three.js组件以减少初始bundle大小
const Director3DViewer = lazy(() => import("./canvas-director3d-viewer"));

type Props = {
    node: CanvasNodeData;
    isSelected: boolean;
    onUpdate: (metadata: any) => void;
};

export function CanvasDirector3DNode({ node, isSelected, onUpdate }: Props) {
    const [sceneData, setSceneData] = useState<Scene3DSnapshot>(() => {
        return node.metadata?.director3DSceneData || createDefaultSceneSnapshot();
    });

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // 同步场景数据到节点元数据
    useEffect(() => {
        if (isEditing) {
            onUpdate({
                director3DSceneData: sceneData,
                director3DCameraCount: sceneData.cameras.length,
                director3DLightCount: sceneData.lights.length,
                director3DModelCount: sceneData.models.length,
            });
        }
    }, [sceneData, isEditing, onUpdate]);

    const handleSceneUpdate = (newSnapshot: Scene3DSnapshot) => {
        setSceneData(newSnapshot);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // 这里可以添加保存到后端的逻辑
            await new Promise((resolve) => setTimeout(resolve, 300));
            setIsEditing(false);
        } catch (error) {
            console.error("保存3D场景失败:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-gray-900 rounded-lg overflow-hidden"
            style={{
                border: isSelected ? "2px solid #3b82f6" : "1px solid #374151",
            }}
        >
            {/* 头部工具栏 */}
            <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-3">
                <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-400">
                        {sceneData.cameras.length} 相机 · {sceneData.lights.length} 光源 ·{" "}
                        {sceneData.models.length} 模型
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            编辑
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                                disabled={isSaving}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                disabled={isSaving}
                            >
                                {isSaving ? "保存中..." : "保存"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 3D视图区域 */}
            <div className="relative" style={{ height: "calc(100% - 2.5rem)" }}>
                <Suspense
                    fallback={
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                                <div className="text-sm text-gray-400">加载3D引擎...</div>
                            </div>
                        </div>
                    }
                >
                    <Director3DViewer
                        snapshot={sceneData}
                        isEditing={isEditing}
                        onUpdate={handleSceneUpdate}
                        width={node.width}
                        height={node.height - 40}
                    />
                </Suspense>

                {/* WebGL不支持提示 */}
                {typeof window !== "undefined" && !checkWebGLSupport() && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <div className="text-center text-gray-400 px-4">
                            <svg
                                className="mx-auto mb-4 h-12 w-12"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                            <p className="text-sm">您的浏览器不支持 WebGL</p>
                            <p className="text-xs mt-1">无法显示3D场景</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * 检查WebGL支持
 */
function checkWebGLSupport(): boolean {
    try {
        const canvas = document.createElement("canvas");
        return !!(
            window.WebGLRenderingContext &&
            (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
        );
    } catch (e) {
        return false;
    }
}
