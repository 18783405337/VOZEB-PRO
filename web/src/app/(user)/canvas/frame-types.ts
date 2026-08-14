/**
 * Canvas Frame 节点类型定义
 *
 * Frame 节点用于组织和分组画布中的其他节点
 */

/**
 * 框架节点数据结构
 */
export type CanvasFrameData = {
    /** 框架唯一标识 */
    frameId: string;
    /** 所属画布项目 ID */
    projectId: string;
    /** 框架标题 */
    title: string;
    /** 框架描述 */
    description?: string;
    /** 框架颜色 */
    color?: string;
    /** 背景透明度 (0-1) */
    backgroundOpacity?: number;
    /** 是否显示标题 */
    showTitle?: boolean;
    /** 包含的节点 ID 列表 */
    childNodeIds?: string[];
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
};

/**
 * 框架样式配置
 */
export type CanvasFrameStyle = {
    /** 边框颜色 */
    borderColor: string;
    /** 背景颜色 */
    backgroundColor: string;
    /** 背景透明度 */
    backgroundOpacity: number;
    /** 边框宽度 */
    borderWidth: number;
    /** 圆角大小 */
    borderRadius: number;
    /** 标题字体大小 */
    titleFontSize: number;
    /** 标题颜色 */
    titleColor: string;
};

/**
 * 框架预设颜色
 */
export const FRAME_COLORS = {
    blue: { name: "蓝色", border: "#3b82f6", background: "#3b82f6" },
    green: { name: "绿色", border: "#10b981", background: "#10b981" },
    yellow: { name: "黄色", border: "#f59e0b", background: "#f59e0b" },
    red: { name: "红色", border: "#ef4444", background: "#ef4444" },
    purple: { name: "紫色", border: "#8b5cf6", background: "#8b5cf6" },
    pink: { name: "粉色", border: "#ec4899", background: "#ec4899" },
    gray: { name: "灰色", border: "#6b7280", background: "#6b7280" },
    orange: { name: "橙色", border: "#f97316", background: "#f97316" },
} as const;

export type FrameColorKey = keyof typeof FRAME_COLORS;

/**
 * 默认框架样式
 */
export const DEFAULT_FRAME_STYLE: CanvasFrameStyle = {
    borderColor: FRAME_COLORS.blue.border,
    backgroundColor: FRAME_COLORS.blue.background,
    backgroundOpacity: 0.05,
    borderWidth: 2,
    borderRadius: 8,
    titleFontSize: 18,
    titleColor: "#111827",
};

/**
 * 框架配置选项
 */
export type CanvasFrameConfig = {
    /** 是否允许调整大小 */
    resizable?: boolean;
    /** 是否允许拖动 */
    draggable?: boolean;
    /** 是否自动调整大小以适应子节点 */
    autoResize?: boolean;
    /** 最小宽度 */
    minWidth?: number;
    /** 最小高度 */
    minHeight?: number;
    /** 内边距 */
    padding?: number;
};

/**
 * 默认框架配置
 */
export const DEFAULT_FRAME_CONFIG: Required<CanvasFrameConfig> = {
    resizable: true,
    draggable: true,
    autoResize: false,
    minWidth: 200,
    minHeight: 150,
    padding: 20,
};
