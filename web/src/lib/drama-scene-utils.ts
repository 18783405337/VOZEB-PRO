import { nanoid } from "nanoid";
import type { DramaShot } from "./drama-project-contract";
import type { SceneGroup, SceneGroupColor, SceneStatistics, SceneTemplate, SceneTransition, ShotMergeConfig, ShotSplitConfig } from "./drama-scene-types";

/**
 * Scene management utility functions
 */

export function createSceneGroup(params: {
    name: string;
    description?: string;
    color?: SceneGroupColor;
    shotIds?: string[];
    sceneId?: string;
    location?: string;
    timeOfDay?: string;
    weather?: string;
    lighting?: string;
    order: number;
}): SceneGroup {
    const now = new Date().toISOString();
    return {
        id: nanoid(),
        name: params.name,
        description: params.description || "",
        color: params.color || "blue",
        shotIds: params.shotIds || [],
        sceneId: params.sceneId,
        location: params.location,
        timeOfDay: params.timeOfDay,
        weather: params.weather,
        lighting: params.lighting,
        order: params.order,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
    };
}

export function updateSceneGroup(scene: SceneGroup, updates: Partial<Omit<SceneGroup, "id" | "createdAt">>): SceneGroup {
    return {
        ...scene,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
}

export function calculateSceneDuration(shotIds: string[], shots: DramaShot[]): number {
    const shotsMap = new Map(shots.map((shot) => [shot.id, shot]));
    return shotIds.reduce((total, shotId) => {
        const shot = shotsMap.get(shotId);
        return total + (shot?.duration || 0);
    }, 0);
}

export function getSceneThumbnail(shotIds: string[], shots: DramaShot[]): string | undefined {
    const shotsMap = new Map(shots.map((shot) => [shot.id, shot]));
    const firstShot = shotIds.length > 0 ? shotsMap.get(shotIds[0]) : undefined;
    return firstShot?.storyboardImageUrl || firstShot?.videoUrl;
}

export function reorderSceneGroups(scenes: SceneGroup[], fromIndex: number, toIndex: number): SceneGroup[] {
    const result = [...scenes];
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    return result.map((scene, index) => updateSceneGroup(scene, { order: index }));
}

export function addShotToScene(scene: SceneGroup, shotId: string, position?: number): SceneGroup {
    const shotIds = [...scene.shotIds];
    if (shotIds.includes(shotId)) {
        return scene;
    }
    if (position !== undefined && position >= 0 && position <= shotIds.length) {
        shotIds.splice(position, 0, shotId);
    } else {
        shotIds.push(shotId);
    }
    return updateSceneGroup(scene, { shotIds });
}

export function removeShotFromScene(scene: SceneGroup, shotId: string): SceneGroup {
    return updateSceneGroup(scene, {
        shotIds: scene.shotIds.filter((id) => id !== shotId),
    });
}

export function moveShotBetweenScenes(fromScene: SceneGroup, toScene: SceneGroup, shotId: string, position?: number): [SceneGroup, SceneGroup] {
    const updatedFromScene = removeShotFromScene(fromScene, shotId);
    const updatedToScene = addShotToScene(toScene, shotId, position);
    return [updatedFromScene, updatedToScene];
}

export function duplicateSceneGroup(scene: SceneGroup, newOrder: number): SceneGroup {
    return createSceneGroup({
        name: `${scene.name} (副本)`,
        description: scene.description,
        color: scene.color,
        shotIds: [...scene.shotIds],
        sceneId: scene.sceneId,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        weather: scene.weather,
        lighting: scene.lighting,
        order: newOrder,
    });
}

export function splitShot(shot: DramaShot, config: ShotSplitConfig, newOrder: number): DramaShot[] {
    const { splitCount, distributeDuration } = config;
    const result: DramaShot[] = [];
    const durationPerShot = distributeDuration ? Math.floor(shot.duration / splitCount) : shot.duration;
    const remainderDuration = distributeDuration ? shot.duration - durationPerShot * splitCount : 0;

    for (let i = 0; i < splitCount; i++) {
        const suffix = String.fromCharCode(65 + i);
        const duration = i === splitCount - 1 ? durationPerShot + remainderDuration : durationPerShot;

        result.push({
            ...shot,
            id: nanoid(),
            order: newOrder + i,
            title: `${shot.title}${suffix}`,
            duration: Math.max(1, duration),
        });
    }

    return result;
}

export function mergeShots(shots: DramaShot[], config: ShotMergeConfig, newOrder: number): DramaShot {
    const sortedShots = shots.sort((a, b) => a.order - b.order);
    const firstShot = sortedShots[0];

    const mergedDialogue = sortedShots
        .map((s) => s.dialogue)
        .filter(Boolean)
        .join("\n");
    const mergedNarration = sortedShots
        .map((s) => s.narration)
        .filter(Boolean)
        .join("\n");
    const mergedDescription = sortedShots
        .map((s) => s.description)
        .filter(Boolean)
        .join(" ");
    const mergedSourceText = sortedShots
        .map((s) => s.sourceText)
        .filter(Boolean)
        .join("\n");

    const totalDuration = sortedShots.reduce((sum, s) => sum + s.duration, 0);

    const characterIds = [...new Set(sortedShots.flatMap((s) => s.characterIds))];
    const propIds = [...new Set(sortedShots.flatMap((s) => s.propIds))];
    const clueIds = [...new Set(sortedShots.flatMap((s) => s.clueIds))];

    return {
        ...firstShot,
        id: nanoid(),
        order: newOrder,
        title: config.mergedTitle || `${firstShot.title} (合并)`,
        description: config.mergedDescription || mergedDescription,
        dialogue: mergedDialogue,
        narration: mergedNarration,
        sourceText: mergedSourceText,
        duration: Math.min(20, totalDuration),
        characterIds,
        propIds,
        clueIds,
        storyboardStatus: undefined,
        storyboardImageUrl: undefined,
        generationStatus: undefined,
        videoUrl: undefined,
    };
}

export function calculateSceneStatistics(sceneGroups: SceneGroup[], shots: DramaShot[]): SceneStatistics {
    const shotsMap = new Map(shots.map((shot) => [shot.id, shot]));
    const allSceneShotIds = new Set(sceneGroups.flatMap((sg) => sg.shotIds));

    let totalDuration = 0;
    let completedShots = 0;
    let pendingShots = 0;
    let failedShots = 0;

    const scenesByLocation: Record<string, number> = {};
    const scenesByTimeOfDay: Record<string, number> = {};

    sceneGroups.forEach((scene) => {
        if (scene.location) {
            scenesByLocation[scene.location] = (scenesByLocation[scene.location] || 0) + 1;
        }
        if (scene.timeOfDay) {
            scenesByTimeOfDay[scene.timeOfDay] = (scenesByTimeOfDay[scene.timeOfDay] || 0) + 1;
        }

        scene.shotIds.forEach((shotId) => {
            const shot = shotsMap.get(shotId);
            if (shot) {
                totalDuration += shot.duration;
                if (shot.generationStatus === "success") {
                    completedShots++;
                } else if (shot.generationStatus === "error") {
                    failedShots++;
                } else {
                    pendingShots++;
                }
            }
        });
    });

    return {
        totalScenes: sceneGroups.length,
        totalShots: allSceneShotIds.size,
        totalDuration,
        completedShots,
        pendingShots,
        failedShots,
        scenesByLocation,
        scenesByTimeOfDay,
    };
}

export function findShotScene(sceneGroups: SceneGroup[], shotId: string): SceneGroup | undefined {
    return sceneGroups.find((scene) => scene.shotIds.includes(shotId));
}

export function filterScenesBySearch(sceneGroups: SceneGroup[], searchTerm: string): SceneGroup[] {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return sceneGroups;

    return sceneGroups.filter((scene) => scene.name.toLowerCase().includes(term) || scene.description.toLowerCase().includes(term) || scene.location?.toLowerCase().includes(term) || scene.timeOfDay?.toLowerCase().includes(term));
}

export function sortScenesByOrder(sceneGroups: SceneGroup[]): SceneGroup[] {
    return [...sceneGroups].sort((a, b) => a.order - b.order);
}

export function createDefaultTransition(): SceneTransition {
    return {
        type: "cut",
        duration: 0,
    };
}

export function updateSceneTransition(scene: SceneGroup, transition: SceneTransition): SceneGroup {
    return updateSceneGroup(scene, { transition });
}

export const sceneColorMap: Record<SceneGroupColor, { bg: string; border: string; text: string }> = {
    blue: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
    green: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
    yellow: { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700" },
    orange: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700" },
    red: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
    purple: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
    pink: { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-700" },
    gray: { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-700" },
};

export const defaultSceneTemplates: SceneTemplate[] = [
    {
        id: "establishing",
        name: "开场建立镜头",
        description: "建立场景位置和氛围",
        category: "establishing",
        defaultSettings: {
            shotCount: 2,
            color: "blue",
        },
        shotTemplates: [
            {
                title: "远景建立",
                description: "展示整体环境",
                duration: 5,
                shotSize: "远景",
                cameraAngle: "平视",
            },
            {
                title: "中景过渡",
                description: "引入主要角色或元素",
                duration: 4,
                shotSize: "中景",
                cameraAngle: "平视",
            },
        ],
    },
    {
        id: "dialogue",
        name: "对话场景",
        description: "两人或多人对话",
        category: "dialogue",
        defaultSettings: {
            shotCount: 4,
            color: "green",
        },
        shotTemplates: [
            {
                title: "双人全景",
                description: "展示对话双方",
                duration: 3,
                shotSize: "全景",
                cameraAngle: "平视",
            },
            {
                title: "角色A特写",
                description: "角色A说话",
                duration: 4,
                shotSize: "特写",
                cameraAngle: "平视",
            },
            {
                title: "角色B特写",
                description: "角色B回应",
                duration: 4,
                shotSize: "特写",
                cameraAngle: "平视",
            },
            {
                title: "反应镜头",
                description: "展示反应",
                duration: 3,
                shotSize: "中景",
                cameraAngle: "平视",
            },
        ],
    },
    {
        id: "action",
        name: "动作场景",
        description: "快节奏动作序列",
        category: "action",
        defaultSettings: {
            shotCount: 5,
            color: "red",
        },
        shotTemplates: [
            {
                title: "动作准备",
                description: "动作前的蓄力",
                duration: 2,
                shotSize: "中景",
                cameraAngle: "平视",
            },
            {
                title: "动作执行",
                description: "主要动作",
                duration: 3,
                shotSize: "全景",
                cameraAngle: "跟随",
            },
            {
                title: "冲击特写",
                description: "冲击瞬间",
                duration: 2,
                shotSize: "特写",
                cameraAngle: "动态",
            },
            {
                title: "反应镜头",
                description: "受影响方反应",
                duration: 2,
                shotSize: "中景",
                cameraAngle: "平视",
            },
            {
                title: "结果展示",
                description: "动作结果",
                duration: 3,
                shotSize: "全景",
                cameraAngle: "平视",
            },
        ],
    },
    {
        id: "montage",
        name: "蒙太奇序列",
        description: "时间流逝或并列内容",
        category: "montage",
        defaultSettings: {
            shotCount: 6,
            color: "purple",
        },
        shotTemplates: [
            {
                title: "蒙太奇1",
                description: "第一组画面",
                duration: 2,
                shotSize: "中景",
                cameraAngle: "平视",
            },
            {
                title: "蒙太奇2",
                description: "第二组画面",
                duration: 2,
                shotSize: "特写",
                cameraAngle: "平视",
            },
            {
                title: "蒙太奇3",
                description: "第三组画面",
                duration: 2,
                shotSize: "全景",
                cameraAngle: "俯视",
            },
            {
                title: "蒙太奇4",
                description: "第四组画面",
                duration: 2,
                shotSize: "中景",
                cameraAngle: "仰视",
            },
            {
                title: "蒙太奇5",
                description: "第五组画面",
                duration: 2,
                shotSize: "特写",
                cameraAngle: "平视",
            },
            {
                title: "蒙太奇6",
                description: "收尾画面",
                duration: 3,
                shotSize: "全景",
                cameraAngle: "平视",
            },
        ],
    },
];

export function createShotsFromTemplate(template: SceneTemplate, startOrder: number, sceneSettings?: Partial<SceneTemplate["defaultSettings"]>): DramaShot[] {
    const settings = { ...template.defaultSettings, ...sceneSettings };

    return template.shotTemplates.map((shotTemplate, index) => ({
        id: nanoid(),
        order: startOrder + index,
        title: shotTemplate.title,
        description: shotTemplate.description,
        sourceText: "",
        shotBoundary: "",
        dialogue: "",
        narration: "",
        utterances: [],
        imagePrompt: "",
        videoPrompt: "",
        cameraMotion: "",
        duration: shotTemplate.duration,
        characterIds: [],
        propIds: [],
        clueIds: [],
        continuity: shotTemplate.shotSize || shotTemplate.cameraAngle
            ? {
                  shotSize: shotTemplate.shotSize || "",
                  cameraAngle: shotTemplate.cameraAngle || "",
                  composition: "",
                  characterBlocking: "",
                  gazeDirection: "",
                  actionStart: "",
                  actionEnd: "",
                  screenDirection: "",
                  axisRule: "",
                  continuityNotes: "",
              }
            : undefined,
    }));
}

export function reorderShotsInScene(scene: SceneGroup, shotIds: string[]): SceneGroup {
    return updateSceneGroup(scene, { shotIds });
}

export function validateSceneGroup(scene: SceneGroup): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!scene.name.trim()) {
        errors.push("场景名称不能为空");
    }

    if (scene.shotIds.length === 0) {
        errors.push("场景必须包含至少一个镜头");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
