/**
 * Canvas Character Reference System - 角色引用类型
 *
 * 用于分镜与角色的绑定、追踪和管理
 */

import type { CharacterRoleInShot } from "./character-types";

/**
 * 角色引用（镜头中的角色关联）
 */
export type CharacterReference = {
    /** 引用唯一标识 */
    id: string;
    /** 角色资产 ID */
    characterId: string;
    /** 角色版本 ID（可选，不指定则使用当前版本） */
    versionId?: string;

    /** 镜头信息 */
    storyboardNodeId: string;
    shotId: string;

    /** 角色在镜头中的角色 */
    roleInShot: CharacterRoleInShot;
    /** 镜头特定的外观备注 */
    appearanceNotes?: string;

    /** 时间戳 */
    createdAt: string;
    updatedAt: string;
};

/**
 * 角色在镜头中的角色类型
 */
export type CharacterRoleInShot =
    | "primary"         // 主要角色（镜头焦点）
    | "secondary"       // 次要角色（重要但非焦点）
    | "background";     // 背景角色（环境组成部分）

/**
 * 角色使用统计
 */
export type CharacterUsageStats = {
    /** 角色 ID */
    characterId: string;
    /** 角色名称 */
    characterName: string;

    /** 使用情况 */
    totalShots: number;             // 总镜头数
    primaryShots: number;           // 主要角色镜头数
    secondaryShots: number;         // 次要角色镜头数
    backgroundShots: number;        // 背景角色镜头数

    /** 出现的场景 */
    scenes: Array<{
        sceneId: string;
        sceneNumber: number;
        sceneTitle: string;
        shotCount: number;
    }>;

    /** 出现的镜头列表 */
    shots: Array<{
        shotId: string;
        shotNumber: number;
        globalOrder: number;
        roleInShot: CharacterRoleInShot;
        sceneId: string;
    }>;

    /** 时间分布 */
    totalDuration?: number;         // 总出镜时长
    screenTimePercentage?: number;  // 占总时长百分比
};

/**
 * 角色替换配置
 */
export type CharacterReplacementConfig = {
    /** 原角色 ID */
    oldCharacterId: string;
    /** 新角色 ID */
    newCharacterId: string;

    /** 替换范围 */
    scope: {
        shotIds?: string[];         // 指定镜头
        sceneIds?: string[];        // 指定场景
        allShots?: boolean;         // 全部镜头
    };

    /** 替换选项 */
    options: {
        updateDescriptions: boolean;    // 更新描述文本
        regenerateImages: boolean;      // 重新生成图片
        keepAppearanceNotes: boolean;   // 保留外观备注
    };
};

/**
 * 角色依赖信息
 */
export type CharacterDependency = {
    characterId: string;
    characterName: string;

    /** 依赖的节点 */
    dependencies: {
        storyboardNodes: Array<{
            nodeId: string;
            nodeTitle: string;
            shotCount: number;
        }>;
        shots: Array<{
            shotId: string;
            shotNumber: number;
            storyboardNodeId: string;
        }>;
        generationTasks: Array<{
            taskId: string;
            status: string;
            shotId: string;
        }>;
    };

    /** 是否可以安全删除 */
    canDelete: boolean;
    /** 删除影响说明 */
    deleteImpact?: string;
};

/**
 * 角色关系图节点
 */
export type CharacterGraphNode = {
    id: string;
    characterId: string;
    characterName: string;
    imageUrl?: string;
    type: string;
    usageCount: number;
};

/**
 * 角色关系图边
 */
export type CharacterGraphEdge = {
    id: string;
    from: string;
    to: string;
    type: "co-appearance" | "relationship";
    weight: number;
    label?: string;
};

/**
 * 角色关系图
 */
export type CharacterRelationshipGraph = {
    nodes: CharacterGraphNode[];
    edges: CharacterGraphEdge[];
};

/**
 * 角色一致性检查请求
 */
export type CharacterConsistencyCheckRequest = {
    characterId: string;
    shotIds: string[];
    threshold?: number;
};

/**
 * 角色一致性检查响应
 */
export type CharacterConsistencyCheckResponse = {
    characterId: string;
    overallScore: number;
    checks: Array<{
        shotId: string;
        score: number;
        passed: boolean;
        issues?: string[];
    }>;
};

/**
 * 获取角色在镜头中的角色显示名称
 */
export function getCharacterRoleLabel(role: CharacterRoleInShot): string {
    const labels: Record<CharacterRoleInShot, string> = {
        primary: "主要",
        secondary: "次要",
        background: "背景",
    };
    return labels[role];
}

/**
 * 获取角色在镜头中的角色颜色
 */
export function getCharacterRoleColor(role: CharacterRoleInShot): string {
    const colors: Record<CharacterRoleInShot, string> = {
        primary: "#3B82F6",     // 蓝色
        secondary: "#8B5CF6",   // 紫色
        background: "#9CA3AF",  // 灰色
    };
    return colors[role];
}
