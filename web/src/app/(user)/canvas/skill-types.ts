/**
 * Canvas Skill 节点类型定义
 *
 * 支持技能模板、分类管理和技能执行引擎
 */

/**
 * 技能分类
 */
export type SkillCategory =
    | "image-processing"    // 图像处理
    | "video-editing"       // 视频编辑
    | "audio-processing"    // 音频处理
    | "text-generation"     // 文本生成
    | "data-analysis"       // 数据分析
    | "automation"          // 自动化
    | "custom";             // 自定义

/**
 * 技能输出模式
 */
export type SkillOutputMode =
    | "inline"      // 内联输出（显示在节点内）
    | "node"        // 节点输出（创建新节点）
    | "download"    // 下载输出（生成文件下载）
    | "preview";    // 预览输出（显示预览界面）

/**
 * 技能参数类型
 */
export type SkillParameterType =
    | "string"
    | "number"
    | "boolean"
    | "select"
    | "multiselect"
    | "file"
    | "color"
    | "range";

/**
 * 技能参数定义
 */
export type SkillParameter = {
    /** 参数名称 */
    name: string;
    /** 参数标签 */
    label: string;
    /** 参数类型 */
    type: SkillParameterType;
    /** 默认值 */
    defaultValue?: unknown;
    /** 是否必填 */
    required?: boolean;
    /** 参数描述 */
    description?: string;
    /** 选项（用于 select/multiselect） */
    options?: Array<{ label: string; value: string | number }>;
    /** 最小值（用于 number/range） */
    min?: number;
    /** 最大值（用于 number/range） */
    max?: number;
    /** 步长（用于 number/range） */
    step?: number;
    /** 占位符 */
    placeholder?: string;
};

/**
 * 技能模板定义
 */
export type SkillTemplate = {
    /** 模板唯一标识 */
    id: string;
    /** 模板名称 */
    name: string;
    /** 模板描述 */
    description: string;
    /** 技能分类 */
    category: SkillCategory;
    /** 图标（lucide 图标名称） */
    icon: string;
    /** 参数定义 */
    parameters: SkillParameter[];
    /** 输出模式 */
    outputMode: SkillOutputMode;
    /** 是否为内置模板 */
    builtin: boolean;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
};

/**
 * 技能实例数据
 */
export type SkillInstanceData = {
    /** 所属模板 ID */
    templateId: string;
    /** 参数值 */
    parameters: Record<string, unknown>;
    /** 执行状态 */
    status: "idle" | "running" | "success" | "error";
    /** 执行进度 (0-100) */
    progress?: number;
    /** 输出结果 */
    output?: SkillOutput;
    /** 错误信息 */
    error?: string;
    /** 最后执行时间 */
    lastExecutedAt?: string;
};

/**
 * 技能输出结果
 */
export type SkillOutput = {
    /** 输出模式 */
    mode: SkillOutputMode;
    /** 输出数据 */
    data: unknown;
    /** 输出预览 URL */
    previewUrl?: string;
    /** 输出节点 ID（node 模式） */
    nodeId?: string;
    /** 下载 URL（download 模式） */
    downloadUrl?: string;
    /** 输出元数据 */
    metadata?: Record<string, unknown>;
};

/**
 * 技能文档数据结构
 */
export type CanvasSkillDocument = {
    /** 技能文档唯一标识 */
    skillId: string;
    /** 所属画布项目 ID */
    projectId: string;
    /** 所属模板 ID */
    templateId: string;
    /** 技能名称（可自定义） */
    name: string;
    /** 参数值 */
    parameters: Record<string, unknown>;
    /** 执行状态 */
    status: "idle" | "running" | "success" | "error";
    /** 执行进度 */
    progress: number;
    /** 输出结果 */
    output: SkillOutput | null;
    /** 错误信息 */
    error: string | null;
    /** 最后执行时间 */
    lastExecutedAt: string | null;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
};

/**
 * 技能执行请求
 */
export type SkillExecutionRequest = {
    /** 技能 ID */
    skillId: string;
    /** 参数值 */
    parameters: Record<string, unknown>;
};

/**
 * 技能执行响应
 */
export type SkillExecutionResponse = {
    /** 执行 ID */
    executionId: string;
    /** 执行状态 */
    status: "queued" | "running" | "success" | "error";
    /** 输出结果 */
    output?: SkillOutput;
    /** 错误信息 */
    error?: string;
};

/**
 * LocalForage 存储键格式
 */
export type CanvasSkillStorageKey = {
    /** 项目 ID */
    projectId: string;
    /** 技能 ID */
    skillId: string;
};

/**
 * 技能统计信息
 */
export type CanvasSkillStats = {
    /** 总执行次数 */
    totalExecutions: number;
    /** 成功次数 */
    successCount: number;
    /** 失败次数 */
    errorCount: number;
    /** 平均执行时间 (ms) */
    avgExecutionTime: number;
    /** 最后执行时间 */
    lastExecutedAt: string;
};

/**
 * 内置技能模板列表
 */
export const BUILTIN_SKILL_TEMPLATES: SkillTemplate[] = [
    {
        id: "image-resize",
        name: "图像调整大小",
        description: "调整图像尺寸和分辨率",
        category: "image-processing",
        icon: "Maximize2",
        parameters: [
            {
                name: "width",
                label: "宽度",
                type: "number",
                defaultValue: 1920,
                required: true,
                min: 1,
                max: 8192,
                description: "目标宽度（像素）",
            },
            {
                name: "height",
                label: "高度",
                type: "number",
                defaultValue: 1080,
                required: true,
                min: 1,
                max: 8192,
                description: "目标高度（像素）",
            },
            {
                name: "maintainAspectRatio",
                label: "保持宽高比",
                type: "boolean",
                defaultValue: true,
                description: "是否保持原始宽高比",
            },
        ],
        outputMode: "node",
        builtin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: "image-filter",
        name: "图像滤镜",
        description: "应用各种图像滤镜效果",
        category: "image-processing",
        icon: "Sparkles",
        parameters: [
            {
                name: "filter",
                label: "滤镜类型",
                type: "select",
                defaultValue: "grayscale",
                required: true,
                options: [
                    { label: "灰度", value: "grayscale" },
                    { label: "模糊", value: "blur" },
                    { label: "锐化", value: "sharpen" },
                    { label: "复古", value: "vintage" },
                    { label: "高对比", value: "contrast" },
                ],
                description: "选择要应用的滤镜",
            },
            {
                name: "intensity",
                label: "强度",
                type: "range",
                defaultValue: 50,
                min: 0,
                max: 100,
                step: 1,
                description: "滤镜效果强度",
            },
        ],
        outputMode: "node",
        builtin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: "text-summarize",
        name: "文本摘要",
        description: "生成文本内容的摘要",
        category: "text-generation",
        icon: "FileText",
        parameters: [
            {
                name: "maxLength",
                label: "最大长度",
                type: "number",
                defaultValue: 200,
                required: true,
                min: 50,
                max: 1000,
                description: "摘要的最大字符数",
            },
            {
                name: "style",
                label: "风格",
                type: "select",
                defaultValue: "concise",
                options: [
                    { label: "简洁", value: "concise" },
                    { label: "详细", value: "detailed" },
                    { label: "要点式", value: "bullet" },
                ],
                description: "摘要风格",
            },
        ],
        outputMode: "inline",
        builtin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: "video-trim",
        name: "视频裁剪",
        description: "裁剪视频片段",
        category: "video-editing",
        icon: "Scissors",
        parameters: [
            {
                name: "startTime",
                label: "开始时间（秒）",
                type: "number",
                defaultValue: 0,
                required: true,
                min: 0,
                description: "裁剪开始时间",
            },
            {
                name: "endTime",
                label: "结束时间（秒）",
                type: "number",
                defaultValue: 10,
                required: true,
                min: 0,
                description: "裁剪结束时间",
            },
        ],
        outputMode: "node",
        builtin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: "audio-normalize",
        name: "音频标准化",
        description: "标准化音频音量",
        category: "audio-processing",
        icon: "Volume2",
        parameters: [
            {
                name: "targetDb",
                label: "目标音量 (dB)",
                type: "range",
                defaultValue: -14,
                min: -30,
                max: 0,
                step: 1,
                description: "标准化的目标音量级别",
            },
        ],
        outputMode: "node",
        builtin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

/**
 * 获取技能分类的显示名称
 */
export function getSkillCategoryLabel(category: SkillCategory): string {
    const labels: Record<SkillCategory, string> = {
        "image-processing": "图像处理",
        "video-editing": "视频编辑",
        "audio-processing": "音频处理",
        "text-generation": "文本生成",
        "data-analysis": "数据分析",
        "automation": "自动化",
        "custom": "自定义",
    };
    return labels[category];
}

/**
 * 获取输出模式的显示名称
 */
export function getOutputModeLabel(mode: SkillOutputMode): string {
    const labels: Record<SkillOutputMode, string> = {
        "inline": "内联显示",
        "node": "创建节点",
        "download": "文件下载",
        "preview": "预览窗口",
    };
    return labels[mode];
}
