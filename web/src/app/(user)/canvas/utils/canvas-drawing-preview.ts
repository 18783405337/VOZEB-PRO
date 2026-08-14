/**
 * Canvas Drawing 预览图生成服务
 *
 * 为 Drawing 节点生成预览缩略图
 * 支持 Excalidraw 和 Tldraw 两种引擎
 */

import type { CanvasDrawingEngine } from "../types";

/**
 * 预览图配置
 */
export type DrawingPreviewOptions = {
    width?: number;
    height?: number;
    scale?: number;
    background?: string;
    format?: "png" | "jpeg" | "webp";
    quality?: number;
};

const DEFAULT_PREVIEW_OPTIONS: Required<DrawingPreviewOptions> = {
    width: 300,
    height: 225,
    scale: 2,
    background: "#ffffff",
    format: "png",
    quality: 0.9,
};

/**
 * 为 Excalidraw 绘图生成预览图
 */
export async function generateExcalidrawPreview(
    elements: any[],
    options: DrawingPreviewOptions = {}
): Promise<Blob> {
    const opts = { ...DEFAULT_PREVIEW_OPTIONS, ...options };

    try {
        // 动态导入 Excalidraw 的导出功能
        const { exportToBlob } = await import("@excalidraw/excalidraw");

        const blob = await exportToBlob({
            elements,
            files: null,
            maxWidthOrHeight: Math.max(opts.width, opts.height),
            mimeType: `image/${opts.format}`,
            quality: opts.quality,
            exportPadding: 20,
        });

        return blob;
    } catch (error) {
        console.error("Failed to generate Excalidraw preview:", error);
        throw new Error("Excalidraw 预览图生成失败");
    }
}

/**
 * 为 Tldraw 绘图生成预览图
 */
export async function generateTldrawPreview(
    editor: any,
    options: DrawingPreviewOptions = {}
): Promise<Blob> {
    const opts = { ...DEFAULT_PREVIEW_OPTIONS, ...options };

    try {
        // 使用 Tldraw editor 的导出功能
        const svg = await editor.getSvg();
        if (!svg) {
            throw new Error("Failed to get SVG from Tldraw");
        }

        // 将 SVG 转换为 Canvas
        const canvas = document.createElement("canvas");
        canvas.width = opts.width * opts.scale;
        canvas.height = opts.height * opts.scale;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get canvas context");
        }

        // 设置背景色
        ctx.fillStyle = opts.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 将 SVG 转换为图片
        const img = new Image();
        const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], {
            type: "image/svg+xml",
        });
        const url = URL.createObjectURL(svgBlob);

        await new Promise<void>((resolve, reject) => {
            img.onload = () => {
                // 计算缩放比例以适应画布
                const scale = Math.min(
                    canvas.width / img.width,
                    canvas.height / img.height
                );
                const x = (canvas.width - img.width * scale) / 2;
                const y = (canvas.height - img.height * scale) / 2;

                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                URL.revokeObjectURL(url);
                resolve();
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load SVG image"));
            };
            img.src = url;
        });

        // 转换为 Blob
        return new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Failed to create blob from canvas"));
                    }
                },
                `image/${opts.format}`,
                opts.quality
            );
        });
    } catch (error) {
        console.error("Failed to generate Tldraw preview:", error);
        throw new Error("Tldraw 预览图生成失败");
    }
}

/**
 * 生成绘图预览图（通用接口）
 */
export async function generateDrawingPreview(
    engine: CanvasDrawingEngine,
    data: any,
    options?: DrawingPreviewOptions
): Promise<Blob> {
    switch (engine) {
        case "excalidraw":
            return generateExcalidrawPreview(data.elements || [], options);
        case "tldraw":
            return generateTldrawPreview(data, options);
        default:
            throw new Error(`Unsupported drawing engine: ${engine}`);
    }
}

/**
 * 将 Blob 转换为 Data URL
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * 将 Data URL 保存到 LocalForage
 */
export async function savePreviewToStorage(
    projectId: string,
    drawingId: string,
    dataUrl: string
): Promise<void> {
    const localforage = (await import("localforage")).default;

    const previewStore = localforage.createInstance({
        name: "canvas-drawings",
        storeName: "previews",
    });

    const key = `${projectId}:${drawingId}:preview`;
    await previewStore.setItem(key, dataUrl);
}

/**
 * 从 LocalForage 获取预览图
 */
export async function getPreviewFromStorage(
    projectId: string,
    drawingId: string
): Promise<string | null> {
    const localforage = (await import("localforage")).default;

    const previewStore = localforage.createInstance({
        name: "canvas-drawings",
        storeName: "previews",
    });

    const key = `${projectId}:${drawingId}:preview`;
    return await previewStore.getItem<string>(key);
}

/**
 * 生成并保存预览图
 */
export async function generateAndSavePreview(
    projectId: string,
    drawingId: string,
    engine: CanvasDrawingEngine,
    data: any,
    options?: DrawingPreviewOptions
): Promise<string> {
    try {
        // 生成预览图
        const blob = await generateDrawingPreview(engine, data, options);

        // 转换为 Data URL
        const dataUrl = await blobToDataUrl(blob);

        // 保存到存储
        await savePreviewToStorage(projectId, drawingId, dataUrl);

        return dataUrl;
    } catch (error) {
        console.error("Failed to generate and save preview:", error);
        throw error;
    }
}

/**
 * 删除预览图
 */
export async function deletePreview(
    projectId: string,
    drawingId: string
): Promise<void> {
    const localforage = (await import("localforage")).default;

    const previewStore = localforage.createInstance({
        name: "canvas-drawings",
        storeName: "previews",
    });

    const key = `${projectId}:${drawingId}:preview`;
    await previewStore.removeItem(key);
}
