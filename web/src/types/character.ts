/**
 * Canvas Character Asset 类型定义
 *
 * 角色资产管理系统的核心类型
 */

/**
 * 角色类型
 */
export type CharacterType =
    | "protagonist"    // 主角
    | "antagonist"     // 反派
    | "supporting"     // 配角
    | "extra"          // 群众演员
    | "narrator";      // 旁白

/**
 * 角色在镜头中的作用
 */
export type CharacterRoleInShot =
    | "primary"        // 主要角色
    | "secondary"      // 次要角色
    | "background";    // 背景角色

/**
 * 角色视觉特征
 */
export type CharacterVisualFeatures = {
    hairColor?: string;
    hairStyle?: string;
    eyeColor?: string;
    height?: string;
    build?: string;
    clothing?: string;
    accessories?: string[];
    distinctiveMarks?: string[];
};

/**
 * 角色关系
 */
export type CharacterRelationship = {
    characterId: string;
    relationship: string;
};

/**
 * 角色元数据
 */
export type CharacterMetadata = {
    age?: number | string;
    gender?: string;
    occupation?: string;
    personality?: string[];
    relationships?: CharacterRelationship[];
    visualFeatures?: CharacterVisualFeatures;
    generationParams?: {
        model?: string;
        seed?: number;
        prompt?: string;
        negativePrompt?: string;
    };
};

/**
 * 角色资产
 */
export type CharacterAsset = {
    id: string;
    userId: string;
    name: string;
    displayName?: string;
    characterType: CharacterType;
    description?: string;
    visualDescription?: string;
    baseImageNodeId?: string;
    baseImageUrl?: string;
    baseImageStorageKey?: string;
    currentVersion: number;
    tags?: string[];
    metadata?: CharacterMetadata;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
};

/**
 * 角色版本
 */
export type CharacterVersion = {
    id: string;
    assetId: string;
    version: number;
    imageUrl?: string;
    imageStorageKey?: string;
    imageNodeId?: string;
    description?: string;
    visualChanges?: string[];
    metadata?: {
        generationParams?: any;
        comparisonScore?: number;
        usageCount?: number;
        approvedBy?: string;
        approvalDate?: string;
    };
    isActive: boolean;
    createdAt: string;
};

/**
 * 角色引用（在分镜中）
 */
export type CharacterReference = {
    id: string;
    projectId: string;
    storyboardNodeId: string;
    shotId: string;
    characterAssetId: string;
    characterVersionId?: string;
    roleInShot: CharacterRoleInShot;
    appearanceNotes?: string;
    position: number;
    metadata?: {
        emotions?: string[];
        actions?: string[];
        wardrobe?: string;
        props?: string[];
        generatedImageUrl?: string;
        consistencyScore?: number;
    };
    createdAt: string;
};

/**
 * 一致性检查类型
 */
export type ConsistencyCheckType =
    | "visual_similarity"
    | "prompt_consistency"
    | "version_comparison"
    | "batch_consistency";

/**
 * 一致性检查结果
 */
export type ConsistencyCheck = {
    id: string;
    characterAssetId: string;
    referenceId?: string;
    checkType: ConsistencyCheckType;
    baseImageUrl?: string;
    targetImageUrl?: string;
    consistencyScore?: number;
    status: "pending" | "running" | "completed" | "failed";
    details?: {
        algorithm?: string;
        metrics?: {
            facialSimilarity?: number;
            colorPaletteSimilarity?: number;
            compositionSimilarity?: number;
            styleSimilarity?: number;
        };
        warnings?: string[];
        suggestions?: string[];
    };
    errorMessage?: string;
    createdAt: string;
    completedAt?: string;
};

/**
 * 角色选择器选项
 */
export type CharacterSelectOption = {
    value: string;
    label: string;
    character: CharacterAsset;
    previewUrl?: string;
};

/**
 * 角色搜索过滤器
 */
export type CharacterSearchFilter = {
    query?: string;
    characterType?: CharacterType[];
    tags?: string[];
    archived?: boolean;
};

/**
 * 角色使用统计
 */
export type CharacterUsageStats = {
    characterId: string;
    totalReferences: number;
    storyboardCount: number;
    shotCount: number;
    lastUsedAt?: string;
    consistencyScore?: number;
};
