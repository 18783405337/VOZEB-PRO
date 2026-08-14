/**
 * Canvas Director 3D Utilities
 *
 * 3D导演台工具函数
 */

import type { Camera3D, Light3D, Model3D, Scene3DSnapshot, Vector3 } from "./types-director3d";

/**
 * 创建默认相机
 */
export function createDefaultCamera(id?: string): Camera3D {
    return {
        id: id || `camera-${Date.now()}`,
        name: "相机",
        position: [5, 5, 5],
        target: [0, 0, 0],
        fov: 75,
        aspect: 4 / 3,
        near: 0.1,
        far: 1000,
    };
}

/**
 * 创建默认环境光
 */
export function createAmbientLight(id?: string): Light3D {
    return {
        id: id || `light-ambient-${Date.now()}`,
        name: "环境光",
        type: "ambient",
        color: "#404040",
        intensity: 0.5,
    };
}

/**
 * 创建默认平行光
 */
export function createDirectionalLight(id?: string): Light3D {
    return {
        id: id || `light-directional-${Date.now()}`,
        name: "平行光",
        type: "directional",
        color: "#ffffff",
        intensity: 1.0,
        position: [10, 10, 10],
        direction: [-1, -1, -1],
        castShadow: true,
    };
}

/**
 * 创建点光源
 */
export function createPointLight(id?: string): Light3D {
    return {
        id: id || `light-point-${Date.now()}`,
        name: "点光源",
        type: "point",
        color: "#ffffff",
        intensity: 1.0,
        position: [0, 5, 0],
    };
}

/**
 * 创建聚光灯
 */
export function createSpotLight(id?: string): Light3D {
    return {
        id: id || `light-spot-${Date.now()}`,
        name: "聚光灯",
        type: "spot",
        color: "#ffffff",
        intensity: 1.0,
        position: [0, 10, 0],
        direction: [0, -1, 0],
        castShadow: true,
    };
}

/**
 * 创建默认场景快照
 */
export function createDefaultSceneSnapshot(): Scene3DSnapshot {
    return {
        cameras: [createDefaultCamera("main-camera")],
        lights: [
            createAmbientLight("ambient-light"),
            createDirectionalLight("directional-light"),
        ],
        models: [],
        environment: {
            backgroundColor: "#1a1a1a",
            gridVisible: true,
            axesVisible: true,
            shadowsEnabled: true,
            fogEnabled: false,
        },
        activeCamera: "main-camera",
    };
}

/**
 * 计算两点之间的距离
 */
export function distance3D(a: Vector3, b: Vector3): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 向量归一化
 */
export function normalize3D(v: Vector3): Vector3 {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (length === 0) return [0, 0, 0];
    return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * 向量加法
 */
export function add3D(a: Vector3, b: Vector3): Vector3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * 向量减法
 */
export function subtract3D(a: Vector3, b: Vector3): Vector3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * 向量缩放
 */
export function scale3D(v: Vector3, s: number): Vector3 {
    return [v[0] * s, v[1] * s, v[2] * s];
}

/**
 * 计算相机视锥体的8个顶点（用于可视化）
 */
export function calculateCameraFrustum(camera: Camera3D): Vector3[] {
    const { position, target, fov, aspect, near, far } = camera;

    // 简化实现：返回近平面和远平面的4个角点
    const fovRad = (fov * Math.PI) / 180;
    const nearHeight = 2 * Math.tan(fovRad / 2) * near;
    const nearWidth = nearHeight * aspect;
    const farHeight = 2 * Math.tan(fovRad / 2) * far;
    const farWidth = farHeight * aspect;

    // 计算相机方向
    const direction = normalize3D(subtract3D(target, position));

    // 这里返回一个简化的锥体表示
    // 实际实现需要完整的相机矩阵计算
    return [
        position,
        add3D(position, scale3D(direction, near)),
        add3D(position, scale3D(direction, far)),
        target,
    ];
}

/**
 * 验证向量是否有效
 */
export function isValidVector3(v: any): v is Vector3 {
    return (
        Array.isArray(v) &&
        v.length === 3 &&
        v.every((n) => typeof n === "number" && !isNaN(n) && isFinite(n))
    );
}

/**
 * 验证相机配置是否有效
 */
export function isValidCamera(camera: any): camera is Camera3D {
    return (
        camera &&
        typeof camera.id === "string" &&
        typeof camera.name === "string" &&
        isValidVector3(camera.position) &&
        isValidVector3(camera.target) &&
        typeof camera.fov === "number" &&
        camera.fov > 0 &&
        camera.fov < 180 &&
        typeof camera.aspect === "number" &&
        camera.aspect > 0
    );
}

/**
 * 验证光源配置是否有效
 */
export function isValidLight(light: any): light is Light3D {
    const validTypes: LightType[] = ["ambient", "directional", "point", "spot"];

    return (
        light &&
        typeof light.id === "string" &&
        typeof light.name === "string" &&
        validTypes.includes(light.type) &&
        typeof light.color === "string" &&
        typeof light.intensity === "number" &&
        light.intensity >= 0
    );
}

/**
 * 生成场景缩略图数据（占位实现）
 */
export function generateSceneThumbnail(snapshot: Scene3DSnapshot): string {
    // 实际实现需要使用 Three.js 渲染缩略图
    // 这里返回一个占位符
    return `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
            <rect width="200" height="150" fill="${snapshot.environment.backgroundColor}"/>
            <text x="100" y="75" text-anchor="middle" fill="#888" font-family="Arial" font-size="14">
                3D Scene
            </text>
            <text x="100" y="95" text-anchor="middle" fill="#666" font-family="Arial" font-size="12">
                ${snapshot.cameras.length} cameras, ${snapshot.lights.length} lights
            </text>
        </svg>
    `)}`;
}

/**
 * 导出场景为JSON
 */
export function exportSceneAsJSON(snapshot: Scene3DSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
}

/**
 * 从JSON导入场景
 */
export function importSceneFromJSON(json: string): Scene3DSnapshot | null {
    try {
        const snapshot = JSON.parse(json);

        // 基本验证
        if (!snapshot.cameras || !Array.isArray(snapshot.cameras)) return null;
        if (!snapshot.lights || !Array.isArray(snapshot.lights)) return null;
        if (!snapshot.models || !Array.isArray(snapshot.models)) return null;
        if (!snapshot.environment || typeof snapshot.environment !== "object") return null;

        return snapshot;
    } catch (error) {
        console.error("Failed to import scene:", error);
        return null;
    }
}
