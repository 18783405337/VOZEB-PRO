/**
 * Canvas Drawing 节点类型定义
 *
 * 支持 Excalidraw 和 Tldraw 两种绘图引擎
 */

import type { CanvasDrawingEngine } from "./types";

/**
 * 绘图文档数据结构
 */
export type CanvasDrawingDocument = {
    /** 绘图文档唯一标识 */
    drawingId: string;
    /** 所属画布项目 ID */
    projectId: string;
    /** 绘图引擎类型 */
    engine: CanvasDrawingEngine;
    /** 绘图数据快照 (引擎特定格式) */
    snapshot: unknown;
    /** 文档版本号 */
    revision: number;
    /** 图形数量 */
    shapeCount: number;
    /** 页面数量 */
    pageCount: number;
    /** 预览图 URL */
    previewUrl?: string;
    /** 生成渲染数据 */
    renderUrl?: string;
    renderMetadata?: CanvasDrawingRenderMetadata;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
};

/**
 * 绘图渲染元数据
 */
export type CanvasDrawingRenderMetadata = {
    /** 渲染页面 ID (tldraw) */
    pageId?: string;
    /** 渲染宽度 */
    width: number;
    /** 渲染高度 */
    height: number;
    /** MIME 类型 */
    mimeType: string;
    /** 背景色 */
    background?: string;
};

/**
 * 绘图文档版本历史
 */
export type CanvasDrawingVersion = {
    /** 版本号 */
    revision: number;
    /** 版本快照 */
    snapshot: unknown;
    /** 创建时间 */
    createdAt: string;
    /** 变更描述 */
    description?: string;
};

/**
 * LocalForage 存储键格式
 */
export type CanvasDrawingStorageKey = {
    /** 项目 ID */
    projectId: string;
    /** 绘图 ID */
    drawingId: string;
};

/**
 * 绘图编辑器配置
 */
export type CanvasDrawingEditorConfig = {
    /** 当前引擎 */
    engine: CanvasDrawingEngine;
    /** 是否只读 */
    readOnly?: boolean;
    /** 自动保存间隔 (ms) */
    autoSaveInterval?: number;
    /** 是否显示工具栏 */
    showToolbar?: boolean;
    /** 初始数据 */
    initialData?: unknown;
};

/**
 * Excalidraw 特定类型 (简化版)
 */
export type ExcalidrawElement = {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    strokeColor: string;
    backgroundColor: string;
    fillStyle: string;
    strokeWidth: number;
    roughness: number;
    opacity: number;
    [key: string]: unknown;
};

export type ExcalidrawState = {
    elements: ExcalidrawElement[];
    appState: {
        viewBackgroundColor: string;
        [key: string]: unknown;
    };
    files?: Record<string, unknown>;
};

/**
 * Tldraw 特定类型 (简化版)
 */
export type TldrawShape = {
    id: string;
    type: string;
    x: number;
    y: number;
    props: Record<string, unknown>;
    [key: string]: unknown;
};

export type TldrawSnapshot = {
    store: Record<string, unknown>;
    schema: {
        schemaVersion: number;
        storeVersion: number;
    };
};

/**
 * 绘图导出选项
 */
export type CanvasDrawingExportOptions = {
    /** 导出格式 */
    format: "png" | "svg" | "json";
    /** 导出质量 (PNG) */
    quality?: number;
    /** 背景色 */
    background?: string;
    /** 是否包含边距 */
    padding?: number;
    /** 缩放比例 */
    scale?: number;
};

/**
 * 绘图统计信息
 */
export type CanvasDrawingStats = {
    /** 图形总数 */
    shapeCount: number;
    /** 页面总数 */
    pageCount: number;
    /** 文档大小 (bytes) */
    documentSize: number;
    /** 最后编辑时间 */
    lastEditedAt: string;
    /** 编辑次数 */
    editCount: number;
};
