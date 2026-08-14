/**
 * Canvas Skill Storage Utilities
 *
 * 处理技能数据的本地存储（LocalForage）
 */

import localforage from "localforage";
import type { CanvasSkillStorageKey } from "../skill-types";

/**
 * 生成存储键
 */
function generateStorageKey(key: CanvasSkillStorageKey): string {
    return `canvas-skill:${key.projectId}:${key.skillId}`;
}

/**
 * 保存技能参数到本地存储
 */
export async function saveSkillParametersLocal(
    key: CanvasSkillStorageKey,
    parameters: Record<string, unknown>
): Promise<void> {
    const storageKey = generateStorageKey(key);
    await localforage.setItem(storageKey, {
        parameters,
        savedAt: new Date().toISOString(),
    });
}

/**
 * 从本地存储加载技能参数
 */
export async function loadSkillParametersLocal(
    key: CanvasSkillStorageKey
): Promise<Record<string, unknown> | null> {
    const storageKey = generateStorageKey(key);
    const data = await localforage.getItem<{
        parameters: Record<string, unknown>;
        savedAt: string;
    }>(storageKey);

    return data?.parameters || null;
}

/**
 * 删除本地存储的技能参数
 */
export async function deleteSkillParametersLocal(
    key: CanvasSkillStorageKey
): Promise<void> {
    const storageKey = generateStorageKey(key);
    await localforage.removeItem(storageKey);
}

/**
 * 清除项目的所有技能本地数据
 */
export async function clearProjectSkillsLocal(projectId: string): Promise<void> {
    const keys = await localforage.keys();
    const projectPrefix = `canvas-skill:${projectId}:`;

    const deletePromises = keys
        .filter(key => key.startsWith(projectPrefix))
        .map(key => localforage.removeItem(key));

    await Promise.all(deletePromises);
}

/**
 * 获取项目的所有技能本地数据
 */
export async function listProjectSkillsLocal(projectId: string): Promise<string[]> {
    const keys = await localforage.keys();
    const projectPrefix = `canvas-skill:${projectId}:`;

    return keys
        .filter(key => key.startsWith(projectPrefix))
        .map(key => key.replace(projectPrefix, ""));
}
