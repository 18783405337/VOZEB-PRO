/**
 * Canvas Storyboard 节点类型定义
 *
 * 分镜脚本系统 - 支持场景管理、镜头编排、时间轴编辑和批量生成
 */

/**
 * 景别/镜头类型
 */
export type ShotType =
    | "extreme-wide"    // 大远景 (EWS)
    | "wide"            // 远景 (WS)
    | "full"            // 全景 (FS)
    | "medium"          // 中景 (MS)
    | "close-up"        // 近景 (CU)
    | "extreme-close-up" // 特写 (ECU)
    | "over-shoulder"   // 过肩镜头 (OTS)
    | "two-shot";       // 双人镜头

/**
 * 机位/摄像机角度
 */
export type CameraAngle =
    | "eye-level"       // 平视
    | "high"            // 俯视
    | "low"             // 仰视
    | "overhead"        // 顶视
    | "dutch"           // 荷兰角
    | "pov";            // 主观视角 (POV)

/**
 * 运镜方式
 */
export type CameraMovement =
    | "static"          // 静止
    | "pan"             // 摇镜
    | "tilt"            // 倾斜
    | "dolly"           // 推拉
    | "track"           // 跟踪
    | "crane"           // 升降
    | "handheld"        // 手持
    | "zoom"            // 变焦
    | "steadicam";      // 斯坦尼康

/**
 * 转场效果
 */
export type TransitionType =
    | "cut"             // 切
    | "fade"            // 淡入淡出
    | "dissolve"        // 叠化
    | "wipe"            // 划像
    | "match-cut";      // 匹配剪辑

/**
 * 镜头优先级
 */
export type ShotPriority =
    | "low"             // 低优先级
    | "normal"          // 普通
    | "high"            // 高优先级
    | "critical";       // 关键镜头

/**
 * 镜头状态
 */
export type ShotStatus =
    | "draft"           // 草稿
    | "pending"         // 待生成
    | "generating"      // 生成中
    | "completed"       // 已完成
    | "failed"          // 失败
    | "approved"        // 已通过
    | "revision";       // 需修订

/**
 * 单个镜头数据
 */
export type StoryboardShot = {
    /** 镜头唯一标识 */
    id: string;
    /** 所属场景 ID */
    sceneId: string;
    /** 场景内序号 */
    shotNumber: number;
    /** 全局序号 */
    globalOrder: number;

    /** 基础信息 */
    title?: string;
    description: string;
    visualDescription?: string;

    /** 镜头参数 */
    shotType: ShotType;
    cameraAngle: CameraAngle;
    cameraMovement: CameraMovement;

    /** 时长和转场 */
    duration: number;               // 秒
    transition: TransitionType;
    transitionDuration?: number;    // 秒

    /** 内容 */
    dialogue?: string;
    action?: string;
    sound?: string;
    music?: string;

    /** 视觉参考 */
    imageUrl?: string;
    imageStorageKey?: string;
    imageTaskId?: string;
    videoUrl?: string;
    videoStorageKey?: string;
    videoTaskId?: string;
    referenceImageIds?: string[];   // 关联的参考图节点 ID

    /** 生成配置 */
    prompt?: string;
    generationModel?: string;
    generationParams?: Record<string, unknown>;

    /** 元数据 */
    status: ShotStatus;
    priority: ShotPriority;
    tags?: string[];
    notes?: string;
    characterIds?: string[];        // 关联角色 ID
    locationId?: string;            // 关联场地 ID

    /** 时间戳 */
    createdAt: string;
    updatedAt: string;
};

/**
 * 场景数据
 */
export type StoryboardScene = {
    /** 场景唯一标识 */
    id: string;
    /** 场景编号 */
    sceneNumber: number;
    /** 场景标题 */
    title: string;
    /** 场景描述 */
    description?: string;

    /** 场景设置 */
    location?: string;              // 地点
    timeOfDay?: string;             // 时间（白天/夜晚等）
    weather?: string;               // 天气
    mood?: string;                  // 情绪氛围

    /** 颜色标记 */
    color?: string;                 // 场景颜色标签

    /** 镜头列表 */
    shotIds: string[];

    /** 元数据 */
    collapsed?: boolean;            // 是否折叠
    duration?: number;              // 总时长（自动计算）

    /** 时间戳 */
    createdAt: string;
    updatedAt: string;
};

/**
 * 分镜表数据
 */
export type StoryboardData = {
    /** 分镜表 ID */
    storyboardId: string;
    /** 项目 ID */
    projectId: string;
    /** 标题 */
    title: string;
    /** 描述 */
    description?: string;

    /** 场景列表 */
    scenes: StoryboardScene[];
    /** 镜头列表 */
    shots: StoryboardShot[];

    /** 显示配置 */
    columnConfig?: StoryboardColumnConfig;

    /** 时间轴配置 */
    timelineConfig?: {
        zoom: number;               // 缩放级别
        showThumbnails: boolean;    // 显示缩略图
        snapToGrid: boolean;        // 对齐网格
        gridInterval: number;       // 网格间隔（秒）
    };

    /** 版本信息 */
    revision: number;

    /** 时间戳 */
    createdAt: string;
    updatedAt: string;
};

/**
 * 列配置
 */
export type StoryboardColumnConfig = {
    /** 可见列 */
    visibleColumns: string[];
    /** 列宽度 */
    columnWidths: Record<string, number>;
    /** 列顺序 */
    columnOrder: string[];
    /** 固定列 */
    pinnedColumns?: string[];
};

/**
 * 默认列定义
 */
export const STORYBOARD_COLUMNS = [
    { id: "shotNumber", label: "镜号", width: 60, pinned: true },
    { id: "thumbnail", label: "缩略图", width: 120, pinned: false },
    { id: "sceneNumber", label: "场次", width: 60, pinned: false },
    { id: "shotType", label: "景别", width: 100, pinned: false },
    { id: "cameraAngle", label: "机位", width: 100, pinned: false },
    { id: "cameraMovement", label: "运镜", width: 100, pinned: false },
    { id: "description", label: "画面描述", width: 200, pinned: false },
    { id: "visualDescription", label: "视觉细节", width: 200, pinned: false },
    { id: "dialogue", label: "对白", width: 150, pinned: false },
    { id: "action", label: "动作", width: 150, pinned: false },
    { id: "sound", label: "音效", width: 120, pinned: false },
    { id: "music", label: "音乐", width: 120, pinned: false },
    { id: "duration", label: "时长(秒)", width: 80, pinned: false },
    { id: "transition", label: "转场", width: 100, pinned: false },
    { id: "location", label: "场地", width: 100, pinned: false },
    { id: "timeOfDay", label: "时间", width: 80, pinned: false },
    { id: "status", label: "状态", width: 100, pinned: false },
    { id: "priority", label: "优先级", width: 80, pinned: false },
    { id: "notes", label: "备注", width: 150, pinned: false },
] as const;

/**
 * 批量生成配置
 */
export type StoryboardBatchGenerationConfig = {
    /** 选中的镜头 ID */
    shotIds: string[];
    /** 生成类型 */
    generationType: "image" | "video";
    /** 生成模型 */
    model?: string;
    /** 批量生成设置 */
    batchSettings: {
        concurrent: number;         // 并发数
        retryOnFailure: boolean;    // 失败重试
        maxRetries: number;         // 最大重试次数
        applyToAll?: boolean;       // 应用到所有镜头
    };
    /** 覆盖参数 */
    overrideParams?: Record<string, unknown>;
};

/**
 * 批量生成任务
 */
export type StoryboardBatchTask = {
    /** 任务 ID */
    id: string;
    /** 分镜表 ID */
    storyboardId: string;
    /** 配置 */
    config: StoryboardBatchGenerationConfig;
    /** 状态 */
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    /** 进度 */
    progress: {
        total: number;
        completed: number;
        failed: number;
        current?: string;           // 当前处理的镜头 ID
    };
    /** 结果 */
    results: Array<{
        shotId: string;
        status: "success" | "failed";
        imageUrl?: string;
        videoUrl?: string;
        error?: string;
        taskId?: string;
    }>;
    /** 时间戳 */
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
};

/**
 * LocalForage 存储键格式
 */
export type StoryboardStorageKey = {
    projectId: string;
    storyboardId: string;
};

/**
 * 分镜节点元数据
 */
export type StoryboardNodeMetadata = {
    storyboardId: string;
    revision: number;
    shotCount: number;
    sceneCount: number;
    totalDuration: number;
    lastEditedAt: string;
};

/**
 * 获取景别显示名称
 */
export function getShotTypeLabel(type: ShotType): string {
    const labels: Record<ShotType, string> = {
        "extreme-wide": "大远景 (EWS)",
        "wide": "远景 (WS)",
        "full": "全景 (FS)",
        "medium": "中景 (MS)",
        "close-up": "近景 (CU)",
        "extreme-close-up": "特写 (ECU)",
        "over-shoulder": "过肩 (OTS)",
        "two-shot": "双人镜头",
    };
    return labels[type];
}

/**
 * 获取机位显示名称
 */
export function getCameraAngleLabel(angle: CameraAngle): string {
    const labels: Record<CameraAngle, string> = {
        "eye-level": "平视",
        "high": "俯视",
        "low": "仰视",
        "overhead": "顶视",
        "dutch": "荷兰角",
        "pov": "主观视角 (POV)",
    };
    return labels[angle];
}

/**
 * 获取运镜显示名称
 */
export function getCameraMovementLabel(movement: CameraMovement): string {
    const labels: Record<CameraMovement, string> = {
        "static": "静止",
        "pan": "摇镜",
        "tilt": "倾斜",
        "dolly": "推拉",
        "track": "跟踪",
        "crane": "升降",
        "handheld": "手持",
        "zoom": "变焦",
        "steadicam": "斯坦尼康",
    };
    return labels[movement];
}

/**
 * 获取转场显示名称
 */
export function getTransitionTypeLabel(type: TransitionType): string {
    const labels: Record<TransitionType, string> = {
        "cut": "切",
        "fade": "淡入淡出",
        "dissolve": "叠化",
        "wipe": "划像",
        "match-cut": "匹配剪辑",
    };
    return labels[type];
}

/**
 * 获取状态显示名称和颜色
 */
export function getShotStatusInfo(status: ShotStatus): { label: string; color: string } {
    const info: Record<ShotStatus, { label: string; color: string }> = {
        "draft": { label: "草稿", color: "#9CA3AF" },
        "pending": { label: "待生成", color: "#F59E0B" },
        "generating": { label: "生成中", color: "#3B82F6" },
        "completed": { label: "已完成", color: "#10B981" },
        "failed": { label: "失败", color: "#EF4444" },
        "approved": { label: "已通过", color: "#8B5CF6" },
        "revision": { label: "需修订", color: "#F97316" },
    };
    return info[status];
}

/**
 * 获取优先级显示名称和颜色
 */
export function getShotPriorityInfo(priority: ShotPriority): { label: string; color: string } {
    const info: Record<ShotPriority, { label: string; color: string }> = {
        "low": { label: "低", color: "#9CA3AF" },
        "normal": { label: "普通", color: "#6B7280" },
        "high": { label: "高", color: "#F59E0B" },
        "critical": { label: "关键", color: "#EF4444" },
    };
    return info[priority];
}

/**
 * 创建默认镜头
 */
export function createDefaultShot(sceneId: string, shotNumber: number, globalOrder: number): StoryboardShot {
    const now = new Date().toISOString();
    return {
        id: `shot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sceneId,
        shotNumber,
        globalOrder,
        description: "",
        shotType: "medium",
        cameraAngle: "eye-level",
        cameraMovement: "static",
        duration: 3,
        transition: "cut",
        status: "draft",
        priority: "normal",
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * 创建默认场景
 */
export function createDefaultScene(sceneNumber: number): StoryboardScene {
    const now = new Date().toISOString();
    return {
        id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sceneNumber,
        title: `场景 ${sceneNumber}`,
        shotIds: [],
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * 计算场景总时长
 */
export function calculateSceneDuration(scene: StoryboardScene, shots: StoryboardShot[]): number {
    const sceneShots = shots.filter(shot => shot.sceneId === scene.id);
    return sceneShots.reduce((total, shot) => total + shot.duration, 0);
}

/**
 * 计算分镜总时长
 */
export function calculateTotalDuration(shots: StoryboardShot[]): number {
    return shots.reduce((total, shot) => total + shot.duration, 0);
}
