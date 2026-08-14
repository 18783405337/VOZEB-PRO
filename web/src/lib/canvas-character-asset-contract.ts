/**
 * Character Asset Contract
 * Defines types for canvas character asset management
 */

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

export const CHARACTER_TYPE_LABELS: Record<CharacterAssetType, string> = {
    human: "人物",
    animal: "动物",
    creature: "生物",
    object: "物体",
    vehicle: "载具",
    other: "其他",
};

export const CHARACTER_TYPE_OPTIONS = Object.entries(CHARACTER_TYPE_LABELS).map(([value, label]) => ({
    value: value as CharacterAssetType,
    label,
}));
