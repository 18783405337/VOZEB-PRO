/**
 * Canvas Director 3D Viewer
 *
 * 基于原生Three.js的3D场景查看器 - MVP版本
 * 仅用于演示和占位，实际Three.js集成需要安装相关依赖
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { Scene3DSnapshot, Camera3D, Light3D } from "../types-director3d";

type Props = {
    snapshot: Scene3DSnapshot;
    isEditing: boolean;
    onUpdate: (snapshot: Scene3DSnapshot) => void;
    width: number;
    height: number;
};

/**
 * 3D场景查看器组件
 *
 * 注意: 这是一个占位实现，显示场景的基本信息和控制面板
 * 完整的Three.js实现需要安装以下依赖:
 * - three
 * - @react-three/fiber (可选)
 * - @react-three/drei (可选)
 */
export default function Director3DViewer({ snapshot, isEditing, onUpdate, width, height }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [selectedObject, setSelectedObject] = useState<string | null>(null);

    useEffect(() => {
        // 这里应该初始化Three.js场景
        // 由于Three.js未安装，我们提供一个Canvas 2D的占位渲染
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 清空画布
        ctx.fillStyle = snapshot.environment.backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // 绘制网格（如果启用）
        if (snapshot.environment.gridVisible) {
            drawGrid(ctx, width, height);
        }

        // 绘制坐标轴（如果启用）
        if (snapshot.environment.axesVisible) {
            drawAxes(ctx, width, height);
        }

        // 绘制相机图标
        snapshot.cameras.forEach((camera, index) => {
            drawCamera(ctx, camera, width, height, index === 0);
        });

        // 绘制光源图标
        snapshot.lights.forEach((light) => {
            drawLight(ctx, light, width, height);
        });

        // 绘制信息
        drawInfo(ctx, snapshot, width, height);
    }, [snapshot, width, height]);

    const handleAddCamera = () => {
        const newCamera: Camera3D = {
            id: `camera-${Date.now()}`,
            name: `相机 ${snapshot.cameras.length + 1}`,
            position: [5, 5, 5],
            target: [0, 0, 0],
            fov: 75,
            aspect: width / height,
            near: 0.1,
            far: 1000,
        };

        onUpdate({
            ...snapshot,
            cameras: [...snapshot.cameras, newCamera],
        });
    };

    const handleAddLight = () => {
        const newLight: Light3D = {
            id: `light-${Date.now()}`,
            name: `光源 ${snapshot.lights.length + 1}`,
            type: "point",
            color: "#ffffff",
            intensity: 1.0,
            position: [0, 5, 0],
        };

        onUpdate({
            ...snapshot,
            lights: [...snapshot.lights, newLight],
        });
    };

    return (
        <div className="relative w-full h-full bg-gray-900">
            {/* Canvas渲染区域 */}
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="absolute inset-0"
            />

            {/* Three.js未安装提示 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-6 max-w-md text-center">
                    <div className="text-4xl mb-3">🎬</div>
                    <h3 className="text-lg font-semibold text-white mb-2">3D导演台 (预览模式)</h3>
                    <p className="text-sm text-gray-300 mb-4">
                        完整的3D功能需要安装 Three.js 依赖
                    </p>
                    <div className="text-xs text-gray-400 space-y-1">
                        <div>相机: {snapshot.cameras.length}</div>
                        <div>光源: {snapshot.lights.length}</div>
                        <div>模型: {snapshot.models.length}</div>
                    </div>
                </div>
            </div>

            {/* 编辑工具栏 */}
            {isEditing && (
                <div className="absolute top-4 left-4 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-2 space-y-2 pointer-events-auto">
                    <button
                        onClick={handleAddCamera}
                        className="w-full px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                    >
                        <span>📷</span>
                        <span>添加相机</span>
                    </button>
                    <button
                        onClick={handleAddLight}
                        className="w-full px-3 py-2 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 flex items-center gap-2"
                    >
                        <span>💡</span>
                        <span>添加光源</span>
                    </button>
                    <button
                        disabled
                        className="w-full px-3 py-2 text-xs bg-gray-600 text-gray-400 rounded cursor-not-allowed flex items-center gap-2"
                    >
                        <span>📦</span>
                        <span>导入模型</span>
                    </button>
                </div>
            )}

            {/* 场景信息面板 */}
            <div className="absolute bottom-4 right-4 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs text-gray-300 pointer-events-auto">
                <div className="space-y-1">
                    <div className="font-semibold text-white mb-2">场景信息</div>
                    <div>背景: {snapshot.environment.backgroundColor}</div>
                    <div>网格: {snapshot.environment.gridVisible ? "显示" : "隐藏"}</div>
                    <div>坐标轴: {snapshot.environment.axesVisible ? "显示" : "隐藏"}</div>
                </div>
            </div>
        </div>
    );
}

/**
 * 绘制网格
 */
function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;

    const gridSize = 40;
    const centerX = width / 2;
    const centerY = height / 2;

    // 垂直线
    for (let x = centerX % gridSize; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // 水平线
    for (let y = centerY % gridSize; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

/**
 * 绘制坐标轴
 */
function drawAxes(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const centerX = width / 2;
    const centerY = height / 2;
    const axisLength = 80;

    // X轴 (红色)
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + axisLength, centerY);
    ctx.stroke();

    // Y轴 (绿色)
    ctx.strokeStyle = "#22c55e";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY - axisLength);
    ctx.stroke();

    // Z轴 (蓝色) - 斜线表示深度
    ctx.strokeStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX - axisLength * 0.7, centerY + axisLength * 0.7);
    ctx.stroke();

    // 绘制轴标签
    ctx.font = "12px Arial";
    ctx.fillStyle = "#ef4444";
    ctx.fillText("X", centerX + axisLength + 10, centerY + 5);
    ctx.fillStyle = "#22c55e";
    ctx.fillText("Y", centerX + 5, centerY - axisLength - 10);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("Z", centerX - axisLength * 0.7 - 20, centerY + axisLength * 0.7 + 5);
}

/**
 * 绘制相机图标
 */
function drawCamera(
    ctx: CanvasRenderingContext2D,
    camera: Camera3D,
    width: number,
    height: number,
    isActive: boolean
) {
    const x = width / 2 + camera.position[0] * 20;
    const y = height / 2 - camera.position[1] * 20;

    ctx.fillStyle = isActive ? "#3b82f6" : "#6b7280";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isActive ? "#60a5fa" : "#9ca3af";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制相机名称
    ctx.font = "10px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText(camera.name, x + 12, y + 4);
}

/**
 * 绘制光源图标
 */
function drawLight(ctx: CanvasRenderingContext2D, light: Light3D, width: number, height: number) {
    if (!light.position) return;

    const x = width / 2 + light.position[0] * 20;
    const y = height / 2 - light.position[1] * 20;

    // 根据光源类型选择颜色
    const color = light.type === "ambient" ? "#fbbf24" : "#facc15";

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    // 绘制光晕效果
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();

    // 绘制光源名称
    ctx.font = "10px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText(light.name, x + 12, y + 4);
}

/**
 * 绘制信息文本
 */
function drawInfo(
    ctx: CanvasRenderingContext2D,
    snapshot: Scene3DSnapshot,
    width: number,
    height: number
) {
    ctx.font = "11px Arial";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(
        "提示: 完整的3D功能需要安装 Three.js (pnpm add three)",
        10,
        height - 10
    );
}
