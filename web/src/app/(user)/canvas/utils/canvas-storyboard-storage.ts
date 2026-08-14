/**
 * Canvas Storyboard LocalForage 存储工具
 *
 * 使用 LocalForage 在浏览器端缓存分镜数据
 */

import localforage from "localforage";
import type { StoryboardData, StoryboardStorageKey } from "../storyboard-types";

// 创建专用的 LocalForage 实例
const storyboardStore = localforage.createInstance({
    name: "canvas-storyboard",
    storeName: "storyboards",
    description: "Canvas 分镜脚本本地缓存",
});

/**
 * 生成存储键
 */
function getStorageKey(key: StoryboardStorageKey): string {
    return `${key.projectId}:${key.storyboardId}`;
}

/**
 * 保存分镜数据到本地
 */
export async function saveStoryboardToLocal(
    key: StoryboardStorageKey,
    data: StoryboardData
): Promise<void> {
    try {
        const storageKey = getStorageKey(key);
        await storyboardStore.setItem(storageKey, {
            ...data,
            _cachedAt: new Date().toISOString(),
        });
        console.log(`[Storyboard] Saved to local: ${storageKey}`);
    } catch (error) {
        console.error("[Storyboard] Failed to save to local:", error);
        throw error;
    }
}

/**
 * 从本地加载分镜数据
 */
export async function loadStoryboardFromLocal(
    key: StoryboardStorageKey
): Promise<StoryboardData | null> {
    try {
        const storageKey = getStorageKey(key);
        const data = await storyboardStore.getItem<StoryboardData & { _cachedAt?: string }>(storageKey);

        if (!data) {
            console.log(`[Storyboard] No local data found: ${storageKey}`);
            return null;
        }

        console.log(`[Storyboard] Loaded from local: ${storageKey}`);
        return data;
    } catch (error) {
        console.error("[Storyboard] Failed to load from local:", error);
        return null;
    }
}

/**
 * 删除本地分镜数据
 */
export async function deleteStoryboardFromLocal(key: StoryboardStorageKey): Promise<void> {
    try {
        const storageKey = getStorageKey(key);
        await storyboardStore.removeItem(storageKey);
        console.log(`[Storyboard] Deleted from local: ${storageKey}`);
    } catch (error) {
        console.error("[Storyboard] Failed to delete from local:", error);
        throw error;
    }
}

/**
 * 列出项目的所有本地分镜数据
 */
export async function listProjectStoryboards(projectId: string): Promise<string[]> {
    try {
        const keys = await storyboardStore.keys();
        const projectKeys = keys.filter(key => key.startsWith(`${projectId}:`));
        console.log(`[Storyboard] Found ${projectKeys.length} local storyboards for project ${projectId}`);
        return projectKeys;
    } catch (error) {
        console.error("[Storyboard] Failed to list project storyboards:", error);
        return [];
    }
}

/**
 * 清空所有本地分镜数据
 */
export async function clearAllStoryboards(): Promise<void> {
    try {
        await storyboardStore.clear();
        console.log("[Storyboard] Cleared all local storyboards");
    } catch (error) {
        console.error("[Storyboard] Failed to clear all storyboards:", error);
        throw error;
    }
}

/**
 * 获取本地存储统计信息
 */
export async function getStoryboardStorageStats(): Promise<{
    count: number;
    keys: string[];
}> {
    try {
        const keys = await storyboardStore.keys();
        return {
            count: keys.length,
            keys,
        };
    } catch (error) {
        console.error("[Storyboard] Failed to get storage stats:", error);
        return { count: 0, keys: [] };
    }
}
