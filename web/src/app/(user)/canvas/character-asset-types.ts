/**
 * Character Asset Types for Canvas
 * Re-exports from the contract and adds canvas-specific types
 */

// Asset management types
export type CharacterAssetType = "human" | "animal" | "creature" | "object" | "vehicle" | "other";

export type CharacterVersion = {
    id: string;
    versionNumber: number;
    imageUrl: string;
    storageKey?: string;
    remoteUrl?: string;
    serverUrl?: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    prompt?: string;
    notes?: string;
    createdAt: string;
};

export type CharacterAsset = {
    id: string;
    userId: string;
    name: string;
    description?: string;
    characterType: CharacterAssetType;
    tags: string[];
    baseImageUrl: string;
    thumbnailUrl?: string;
    currentVersion: number;
    versions: CharacterVersion[];
    isArchived: boolean;
    metadata?: {
        age?: string;
        gender?: string;
        appearance?: string;
        personality?: string;
        clothing?: string;
        accessories?: string;
        [key: string]: any;
    };
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
};

export type CharacterReference = {
    id: string;
    characterAssetId: string;
    versionId: string;
    storyboardNodeId?: string;
    canvasProjectId?: string;
    generationParameters?: {
        strength?: number;
        weight?: number;
        mode?: string;
    };
    createdAt: string;
};

export type CharacterListFilters = {
    keyword?: string;
    type?: CharacterAssetType | "all";
    tags?: string[];
    isArchived?: boolean;
};

export type CharacterListSortBy = "name" | "created" | "updated" | "lastUsed";
export type CharacterListSortOrder = "asc" | "desc";

export type CharacterListOptions = {
    page?: number;
    pageSize?: number;
    filters?: CharacterListFilters;
    sortBy?: CharacterListSortBy;
    sortOrder?: CharacterListSortOrder;
};

export type CharacterListResult = {
    characters: CharacterAsset[];
    total: number;
    page: number;
    pageSize: number;
};

export type CharacterViewMode = "grid" | "list";

export type CharacterGroup = {
    id: string;
    name: string;
    description?: string;
    characterIds: string[];
    color?: string;
    createdAt: string;
    updatedAt: string;
};

export type CharacterSelectionMode = "single" | "multiple";

// Canvas Character Node Types (from existing file)
export type CharacterBasicInfo = {
    name: string;
    description: string;
    characterType?: CharacterAssetType;
    tags?: string[];
};

export type CharacterAppearance = {
    visualDescription: string;
    hair?: string;
    eyes?: string;
    body?: string;
    clothing?: string;
    distinctiveFeatures?: string[];
    colorPalette?: string[];
};

export type CharacterPersonality = {
    traits?: string[];
    speakingStyle?: string;
    behaviors?: string[];
    backstory?: string;
};

export type CharacterReferenceImage = {
    imageId: string;
    storageKey?: string;
    remoteUrl?: string;
    serverUrl?: string;
    imageType: "full-body" | "portrait" | "detail" | "pose" | "expression" | "other";
    caption?: string;
    isPrimary?: boolean;
    uploadedAt: string;
    width?: number;
    height?: number;
    bytes?: number;
};

export type ConsistencyCheckResult = {
    checkId: string;
    checkType: "visual_similarity" | "prompt_consistency" | "version_comparison" | "batch_consistency";
    consistencyScore: number;
    status: "pending" | "running" | "completed" | "failed";
    details?: {
        algorithm?: "phash" | "clip" | "ssim" | "face_recognition";
        hammingDistance?: number;
        cosineSimilarity?: number;
        ssimValue?: number;
        faceSimilarity?: number;
        inconsistentFeatures?: string[];
        warnings?: string[];
    };
    baseImageId?: string;
    targetImageId?: string;
    checkedAt: string;
    error?: string;
};

export type VersionDriftInfo = {
    driftFromBase: number;
    driftFromPrevious: number;
    trend: "stable" | "drifting" | "significant_drift";
    recommendation?: string;
};

export type CanvasCharacterDocument = {
    characterId: string;
    projectId: string;
    basicInfo: CharacterBasicInfo;
    appearance: CharacterAppearance;
    personality?: CharacterPersonality;
    referenceImages: CharacterReferenceImage[];
    revision: number;
    createdAt: string;
    updatedAt: string;
    lastConsistencyCheck?: ConsistencyCheckResult;
    versionDrift?: VersionDriftInfo;
};

export type CanvasCharacterVersion = {
    revision: number;
    snapshot: {
        basicInfo: CharacterBasicInfo;
        appearance: CharacterAppearance;
        personality?: CharacterPersonality;
        referenceImages: CharacterReferenceImage[];
    };
    createdAt: string;
    description?: string;
    consistencyScore?: number;
    driftFromBase?: number;
};

export type CanvasCharacterStorageKey = {
    projectId: string;
    characterId: string;
};

export type CanvasCharacterEditorConfig = {
    readOnly?: boolean;
    autoSaveInterval?: number;
    maxReferenceImages?: number;
    enableConsistencyCheck?: boolean;
};

export type ConsistencyCheckOptions = {
    algorithms?: Array<"phash" | "clip" | "ssim" | "face_recognition">;
    threshold?: number;
    checkPrompt?: boolean;
    generateReport?: boolean;
};

export type CanvasCharacterExportOptions = {
    format: "json" | "yaml" | "markdown";
    includeImages?: boolean;
    includeVersionHistory?: boolean;
    prettify?: boolean;
};

export type CanvasCharacterStats = {
    referenceImageCount: number;
    versionCount: number;
    averageConsistencyScore?: number;
    usageCount: number;
    lastEditedAt: string;
    lastUsedAt?: string;
};

export type BatchConsistencyCheckResult = {
    batchId: string;
    characterId: string;
    nodeIds: string[];
    averageScore: number;
    passRate: number;
    individualResults: Array<{
        nodeId: string;
        score: number;
        passed: boolean;
    }>;
    checkedAt: string;
};

export type CharacterPromptTemplate = {
    templateId: string;
    name: string;
    template: string;
    variables?: string[];
    createdAt: string;
};

export type ConsistencyCheckHistory = {
    characterId: string;
    checks: ConsistencyCheckResult[];
    summary: {
        totalChecks: number;
        averageScore: number;
        passRate: number;
        lastCheckedAt?: string;
    };
};
