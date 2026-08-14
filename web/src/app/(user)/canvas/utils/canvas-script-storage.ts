/**
 * Canvas Script Local Storage
 *
 * 使用 LocalForage 管理脚本文档的本地缓存
 */

import localforage from "localforage";
import type { CanvasScriptStorageKey } from "../script-types";

const STORAGE_PREFIX = "canvas-script";
const STORAGE_VERSION = 1;

/**
 * 初始化 LocalForage 实例
 */
const scriptStorage = localforage.createInstance({
    name: "canvas-scripts",
    storeName: "documents",
    version: STORAGE_VERSION,
    description: "Canvas Script documents local storage",
});

/**
 * 生成存储键
 */
function getStorageKey(key: CanvasScriptStorageKey): string {
    return `${STORAGE_PREFIX}:${key.projectId}:${key.scriptId}`;
}

/**
 * 保存脚本内容到本地
 */
export async function saveScriptToLocal(
    key: CanvasScriptStorageKey,
    data: {
        content: any;
        markdown?: string;
        plainText?: string;
        characterCount?: number;
        wordCount?: number;
        revision?: number;
        updatedAt?: string;
    }
): Promise<void> {
    const storageKey = getStorageKey(key);
    await scriptStorage.setItem(storageKey, {
        ...data,
        _cachedAt: new Date().toISOString(),
    });
}

/**
 * 从本地读取脚本内容
 */
export async function loadScriptFromLocal(
    key: CanvasScriptStorageKey
): Promise<{
    content: any;
    markdown?: string;
    plainText?: string;
    characterCount?: number;
    wordCount?: number;
    revision?: number;
    updatedAt?: string;
    _cachedAt?: string;
} | null> {
    const storageKey = getStorageKey(key);
    const data = await scriptStorage.getItem<any>(storageKey);
    return data;
}

/**
 * 删除本地脚本
 */
export async function deleteScriptFromLocal(
    key: CanvasScriptStorageKey
): Promise<void> {
    const storageKey = getStorageKey(key);
    await scriptStorage.removeItem(storageKey);
}

/**
 * 清空项目的所有本地脚本
 */
export async function clearProjectScriptsFromLocal(
    projectId: string
): Promise<void> {
    const keys = await scriptStorage.keys();
    const projectKeys = keys.filter((key) =>
        key.startsWith(`${STORAGE_PREFIX}:${projectId}:`)
    );

    await Promise.all(projectKeys.map((key) => scriptStorage.removeItem(key)));
}

/**
 * 获取所有本地缓存的脚本列表
 */
export async function listLocalScripts(
    projectId: string
): Promise<Array<{ scriptId: string; cachedAt: string }>> {
    const keys = await scriptStorage.keys();
    const projectKeys = keys.filter((key) =>
        key.startsWith(`${STORAGE_PREFIX}:${projectId}:`)
    );

    const scripts = await Promise.all(
        projectKeys.map(async (key) => {
            const data = await scriptStorage.getItem<any>(key);
            const scriptId = key.split(":")[2];
            return {
                scriptId,
                cachedAt: data?._cachedAt || new Date().toISOString(),
            };
        })
    );

    return scripts;
}

/**
 * 检查本地是否有脚本缓存
 */
export async function hasLocalScript(
    key: CanvasScriptStorageKey
): Promise<boolean> {
    const storageKey = getStorageKey(key);
    const data = await scriptStorage.getItem(storageKey);
    return data !== null;
}

/**
 * 获取本地存储大小估算
 */
export async function getLocalStorageSize(): Promise<number> {
    const keys = await scriptStorage.keys();
    let totalSize = 0;

    for (const key of keys) {
        const data = await scriptStorage.getItem(key);
        if (data) {
            // 粗略估算：JSON 字符串长度
            totalSize += JSON.stringify(data).length;
        }
    }

    return totalSize;
}

/**
 * 清理过期的本地缓存（超过指定天数）
 */
export async function cleanupOldLocalScripts(daysOld: number = 30): Promise<number> {
    const keys = await scriptStorage.keys();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let cleaned = 0;

    for (const key of keys) {
        const data = await scriptStorage.getItem<any>(key);
        if (data && data._cachedAt) {
            const cachedDate = new Date(data._cachedAt);
            if (cachedDate < cutoffDate) {
                await scriptStorage.removeItem(key);
                cleaned++;
            }
        }
    }

    return cleaned;
}
