/**
 * Canvas Character 节点类型定义
 *
 * 支持角色资产管理、版本控制和一致性检查
 */

/**
 * 角色基础信息
 */
export type CharacterBasicInfo = {
    /** 角色名称 */
    name: string;
    /** 角色简介 */
    description: string;
    /** 角色类型 */
    characterType?: "human" | "creature" | "object" | "other";
    /** 角色标签 */
    tags?: string[];
};

/**
 * 角色外观描述
 */
export type CharacterAppearance = {
    /** 整体外观描述 */
    visualDescription: string;
    /** 发型和发色 */
    hair?: string;
    /** 眼睛 */
    eyes?: string;
    /** 身高体型 */
    body?: string;
    /** 服装风格 */
    clothing?: string;
    /** 特征标记 */
    distinctiveFeatures?: string[];
    /** 配色方案 */
    colorPalette?: string[];
};

/**
 * 角色性格特点
 */
export type CharacterPersonality = {
    /** 性格描述 */
    traits?: string[];
    /** 说话方式 */
    speakingStyle?: string;
    /** 行为习惯 */
    behaviors?: string[];
    /** 背景故事 */
    backstory?: string;
};

/**
 * 角色参考图片
 */
export type CharacterReferenceImage = {
    /** 图片 ID */
    imageId: string;
    /** 存储键 */
    storageKey?: string;
    /** 远程 URL */
    remoteUrl?: string;
    /** 服务器 URL */
    serverUrl?: string;
    /** 图片类型 */
    imageType: "full-body" | "portrait" | "detail" | "pose" | "expression" | "other";
    /** 图片描述 */
    caption?: string;
    /** 是否为主图 */
    isPrimary?: boolean;
    /** 上传时间 */
    uploadedAt: string;
    /** 图片尺寸 */
    width?: number;
    height?: number;
    /** 文件大小 */
    bytes?: number;
};

/**
 * 一致性检查结果
 */
export type ConsistencyCheckResult = {
    /** 检查 ID */
    checkId: string;
    /** 检查类型 */
    checkType: "visual_similarity" | "prompt_consistency" | "version_comparison" | "batch_consistency";
    /** 一致性得分 (0-1) */
    consistencyScore: number;
    /** 检查状态 */
    status: "pending" | "running" | "completed" | "failed";
    /** 检查详情 */
    details?: {
        /** 使用的算法 */
        algorithm?: "phash" | "clip" | "ssim" | "face_recognition";
        /** 汉明距离 (pHash) */
        hammingDistance?: number;
        /** 余弦相似度 (CLIP) */
        cosineSimilarity?: number;
        /** SSIM 值 */
        ssimValue?: number;
        /** 人脸相似度 */
        faceSimilarity?: number;
        /** 不一致的特征 */
        inconsistentFeatures?: string[];
        /** 警告信息 */
        warnings?: string[];
    };
    /** 基准图片 */
    baseImageId?: string;
    /** 对比图片 */
    targetImageId?: string;
    /** 检查时间 */
    checkedAt: string;
    /** 错误信息 */
    error?: string;
};

/**
 * 版本漂移信息
 */
export type VersionDriftInfo = {
    /** 与基础版本的差异 */
    driftFromBase: number;
    /** 与上一版本的差异 */
    driftFromPrevious: number;
    /** 漂移趋势 */
    trend: "stable" | "drifting" | "significant_drift";
    /** 建议 */
    recommendation?: string;
};

/**
 * 角色文档数据结构
 */
export type CanvasCharacterDocument = {
    /** 角色文档唯一标识 */
    characterId: string;
    /** 所属画布项目 ID */
    projectId: string;
    /** 基础信息 */
    basicInfo: CharacterBasicInfo;
    /** 外观描述 */
    appearance: CharacterAppearance;
    /** 性格特点 */
    personality?: CharacterPersonality;
    /** 参考图片列表 */
    referenceImages: CharacterReferenceImage[];
    /** 文档版本号 */
    revision: number;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
    /** 最后一致性检查 */
    lastConsistencyCheck?: ConsistencyCheckResult;
    /** 版本漂移信息 */
    versionDrift?: VersionDriftInfo;
};

/**
 * 角色文档版本历史
 */
export type CanvasCharacterVersion = {
    /** 版本号 */
    revision: number;
    /** 版本快照 */
    snapshot: {
        basicInfo: CharacterBasicInfo;
        appearance: CharacterAppearance;
        personality?: CharacterPersonality;
        referenceImages: CharacterReferenceImage[];
    };
    /** 创建时间 */
    createdAt: string;
    /** 变更描述 */
    description?: string;
    /** 一致性得分 */
    consistencyScore?: number;
    /** 与基础版本的差异 */
    driftFromBase?: number;
};

/**
 * LocalForage 存储键格式
 */
export type CanvasCharacterStorageKey = {
    /** 项目 ID */
    projectId: string;
    /** 角色 ID */
    characterId: string;
};

/**
 * 角色编辑器配置
 */
export type CanvasCharacterEditorConfig = {
    /** 是否只读 */
    readOnly?: boolean;
    /** 自动保存间隔 (ms) */
    autoSaveInterval?: number;
    /** 最大参考图片数量 */
    maxReferenceImages?: number;
    /** 是否启用一致性检查 */
    enableConsistencyCheck?: boolean;
};

/**
 * 一致性检查选项
 */
export type ConsistencyCheckOptions = {
    /** 检查算法 */
    algorithms?: Array<"phash" | "clip" | "ssim" | "face_recognition">;
    /** 自定义阈值 */
    threshold?: number;
    /** 是否检查提示词一致性 */
    checkPrompt?: boolean;
    /** 是否生成对比报告 */
    generateReport?: boolean;
};

/**
 * 角色导出选项
 */
export type CanvasCharacterExportOptions = {
    /** 导出格式 */
    format: "json" | "yaml" | "markdown";
    /** 是否包含图片 */
    includeImages?: boolean;
    /** 是否包含版本历史 */
    includeVersionHistory?: boolean;
    /** 是否美化输出 */
    prettify?: boolean;
};

/**
 * 角色统计信息
 */
export type CanvasCharacterStats = {
    /** 参考图片总数 */
    referenceImageCount: number;
    /** 版本总数 */
    versionCount: number;
    /** 平均一致性得分 */
    averageConsistencyScore?: number;
    /** 使用次数 (在分镜中) */
    usageCount: number;
    /** 最后编辑时间 */
    lastEditedAt: string;
    /** 最后使用时间 */
    lastUsedAt?: string;
};

/**
 * 批量一致性检查结果
 */
export type BatchConsistencyCheckResult = {
    /** 批次 ID */
    batchId: string;
    /** 角色 ID */
    characterId: string;
    /** 检查的节点 ID 列表 */
    nodeIds: string[];
    /** 平均一致性得分 */
    averageScore: number;
    /** 通过率 */
    passRate: number;
    /** 个别检查结果 */
    individualResults: Array<{
        nodeId: string;
        score: number;
        passed: boolean;
    }>;
    /** 检查时间 */
    checkedAt: string;
};

/**
 * 角色提示词模板
 */
export type CharacterPromptTemplate = {
    /** 模板 ID */
    templateId: string;
    /** 模板名称 */
    name: string;
    /** 提示词模板 */
    template: string;
    /** 变量占位符 */
    variables?: string[];
    /** 创建时间 */
    createdAt: string;
};

/**
 * 一致性检查历史
 */
export type ConsistencyCheckHistory = {
    /** 角色 ID */
    characterId: string;
    /** 检查记录 */
    checks: ConsistencyCheckResult[];
    /** 汇总统计 */
    summary: {
        totalChecks: number;
        averageScore: number;
        passRate: number;
        lastCheckedAt?: string;
    };
};
