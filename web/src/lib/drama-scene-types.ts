/**
 * Scene management types for drama storyboard organization
 */

export type SceneTransitionType = "cut" | "fade" | "dissolve" | "wipe" | "zoom" | "custom";

export type SceneTransition = {
    type: SceneTransitionType;
    duration: number;
    description?: string;
};

export type SceneGroupColor = "blue" | "green" | "yellow" | "orange" | "red" | "purple" | "pink" | "gray";

export type SceneGroup = {
    id: string;
    name: string;
    description: string;
    color: SceneGroupColor;
    shotIds: string[];
    sceneId?: string;
    location?: string;
    timeOfDay?: string;
    weather?: string;
    lighting?: string;
    order: number;
    collapsed?: boolean;
    transition?: SceneTransition;
    thumbnailUrl?: string;
    duration?: number;
    createdAt: string;
    updatedAt: string;
};

export type SceneTemplate = {
    id: string;
    name: string;
    description: string;
    category: "action" | "dialogue" | "establishing" | "transition" | "montage" | "custom";
    defaultSettings: {
        shotCount: number;
        location?: string;
        timeOfDay?: string;
        weather?: string;
        lighting?: string;
        color: SceneGroupColor;
    };
    shotTemplates: Array<{
        title: string;
        description: string;
        duration: number;
        shotSize?: string;
        cameraAngle?: string;
    }>;
};

export type SceneBatchOperation = {
    type: "set_location" | "set_time" | "set_weather" | "set_lighting" | "generate_all" | "delete" | "duplicate";
    sceneGroupIds: string[];
    params?: Record<string, unknown>;
};

export type ShotSplitConfig = {
    shotId: string;
    splitCount: number;
    distributeDuration: boolean;
};

export type ShotMergeConfig = {
    shotIds: string[];
    mergedTitle?: string;
    mergedDescription?: string;
};

export type SceneStatistics = {
    totalScenes: number;
    totalShots: number;
    totalDuration: number;
    completedShots: number;
    pendingShots: number;
    failedShots: number;
    scenesByLocation: Record<string, number>;
    scenesByTimeOfDay: Record<string, number>;
};
