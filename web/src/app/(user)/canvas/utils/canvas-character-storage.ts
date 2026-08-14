/**
 * Canvas Character Local Storage
 *
 * 使用 LocalForage 管理角色文档的本地缓存
 */

import localforage from "localforage";
import type {
    CanvasCharacterStorageKey,
    CanvasCharacterDocument,
    CharacterReferenceImage,
    ConsistencyCheckResult,
} from "../character-types";

const STORAGE_PREFIX = "canvas-character";
const STORAGE_VERSION = 1;

/**
 * 初始化 LocalForage 实例
 */
const characterStorage = localforage.createInstance({
    name: "canvas-characters",
    storeName: "documents",
    version: STORAGE_VERSION,
    description: "Canvas Character documents local storage",
});

/**
 * 初始化图片缓存实例
 */
const imageStorage = localforage.createInstance({
    name: "canvas-characters",
    storeName: "images",
    version: STORAGE_VERSION,
    description: "Canvas Character reference images cache",
});

/**
 * 初始化一致性检查实例
 */
const consistencyStorage = localforage.createInstance({
    name: "canvas-characters",
    storeName: "consistency",
    version: STORAGE_VERSION,
    description: "Canvas Character consistency check results",
});

/**
 * 生成存储键
 */
function getStorageKey(key: CanvasCharacterStorageKey): string {
    return `${STORAGE_PREFIX}:${key.projectId}:${key.characterId}`;
}

/**
 * 生成图片存储键
 */
function getImageStorageKey(
    key: CanvasCharacterStorageKey,
    imageId: string
): string {
    return `${STORAGE_PREFIX}:${key.projectId}:${key.characterId}:img:${imageId}`;
}

/**
 * 生成一致性检查存储键
 */
function getConsistencyStorageKey(
    key: CanvasCharacterStorageKey
): string {
    return `${STORAGE_PREFIX}:${key.projectId}:${key.characterId}:consistency`;
}

/**
 * 保存角色文档到本地
 */
export async function saveCharacterToLocal(
    key: CanvasCharacterStorageKey,
    data: Partial<CanvasCharacterDocument>
): Promise<void> {
    const storageKey = getStorageKey(key);
    await characterStorage.setItem(storageKey, {
        ...data,
        _cachedAt: new Date().toISOString(),
    });
}

/**
 * 从本地读取角色文档
 */
export async function loadCharacterFromLocal(
    key: CanvasCharacterStorageKey
): Promise<(CanvasCharacterDocument & { _cachedAt?: string }) | null> {
    const storageKey = getStorageKey(key);
    const data = await characterStorage.getItem<any>(storageKey);
    return data;
}

/**
 * 删除本地角色文档
 */
export async function deleteCharacterFromLocal(
    key: CanvasCharacterStorageKey
): Promise<void> {
    const storageKey = getStorageKey(key);
    await characterStorage.removeItem(storageKey);

    // 删除关联的图片
    const imageKeys = await imageStorage.keys();
    const characterImageKeys = imageKeys.filter((k) =>
        k.startsWith(`${STORAGE_PREFIX}:${key.projectId}:${key.characterId}:img:`)
    );
    await Promise.all(characterImageKeys.map((k) => imageStorage.removeItem(k)));

    // 删除一致性检查结果
    const consistencyKey = getConsistencyStorageKey(key);
    await consistencyStorage.removeItem(consistencyKey);
}

/**
 * 保存参考图片到本地
 */
export async function saveReferenceImageToLocal(
    key: CanvasCharacterStorageKey,
    imageId: string,
    imageData: {
        dataUrl?: string;
        blob?: Blob;
        metadata?: Partial<CharacterReferenceImage>;
    }
): Promise<void> {
    const imageKey = getImageStorageKey(key, imageId);
    await imageStorage.setItem(imageKey, {
        dataUrl: imageData.dataUrl,
        blob: imageData.blob,
        metadata: imageData.metadata,
        _cachedAt: new Date().toISOString(),
    });
}

/**
 * 从本地读取参考图片
 */
export async function loadReferenceImageFromLocal(
    key: CanvasCharacterStorageKey,
    imageId: string
): Promise<{
    dataUrl?: string;
    blob?: Blob;
    metadata?: Partial<CharacterReferenceImage>;
    _cachedAt?: string;
} | null> {
    const imageKey = getImageStorageKey(key, imageId);
    const data = await imageStorage.getItem<any>(imageKey);
    return data;
}

/**
 * 删除本地参考图片
 */
export async function deleteReferenceImageFromLocal(
    key: CanvasCharacterStorageKey,
    imageId: string
): Promise<void> {
    const imageKey = getImageStorageKey(key, imageId);
    await imageStorage.removeItem(imageKey);
}

/**
 * 保存一致性检查结果
 */
export async function saveConsistencyCheckToLocal(
    key: CanvasCharacterStorageKey,
    checkResult: ConsistencyCheckResult
): Promise<void> {
    const consistencyKey = getConsistencyStorageKey(key);

    // 读取现有历史
    const existing = await consistencyStorage.getItem<any>(consistencyKey);
    const checks = existing?.checks || [];

    // 添加新检查结果
    checks.push(checkResult);

    // 保留最近 50 条记录
    const recentChecks = checks.slice(-50);

    await consistencyStorage.setItem(consistencyKey, {
        checks: recentChecks,
        _updatedAt: new Date().toISOString(),
    });
}

/**
 * 从本地读取一致性检查历史
 */
export async function loadConsistencyHistoryFromLocal(
    key: CanvasCharacterStorageKey
): Promise<ConsistencyCheckResult[]> {
    const consistencyKey = getConsistencyStorageKey(key);
    const data = await consistencyStorage.getItem<any>(consistencyKey);
    return data?.checks || [];
}

/**
 * 清空项目的所有本地角色
 */
export async function clearProjectCharactersFromLocal(
    projectId: string
): Promise<void> {
    // 清理角色文档
    const characterKeys = await characterStorage.keys();
    const projectCharacterKeys = characterKeys.filter((key) =>
        key.startsWith(`${STORAGE_PREFIX}:${projectId}:`)
    );
    await Promise.all(
        projectCharacterKeys.map((key) => characterStorage.removeItem(key))
    );

    // 清理图片
    const imageKeys = await imageStorage.keys();
    const projectImageKeys = imageKeys.filter((key) =>
        key.startsWith(`${STORAGE_PREFIX}:${projectId}:`)
    );
    await Promise.all(
        projectImageKeys.map((key) => imageStorage.removeItem(key))
    );

    // 清理一致性检查
    const consistencyKeys = await consistencyStorage.keys();
    const projectConsistencyKeys = consistencyKeys.filter((key) =>
        key.startsWith(`${STORAGE_PREFIX}:${projectId}:`)
    );
    await Promise.all(
        projectConsistencyKeys.map((key) => consistencyStorage.removeItem(key))
    );
}

/**
 * 获取所有本地缓存的角色列表
 */
export async function listLocalCharacters(
    projectId: string
): Promise<Array<{ characterId: string; cachedAt: string }>> {
    const keys = await characterStorage.keys();
    const projectKeys = keys.filter((key) =>
        key.startsWith(`${STORAGE_PREFIX}:${projectId}:`)
    );

    const characters = await Promise.all(
        projectKeys.map(async (key) => {
            const data = await characterStorage.getItem<any>(key);
            const characterId = key.split(":")[2];
            return {
                characterId,
                cachedAt: data?._cachedAt || new Date().toISOString(),
            };
        })
    );

    return characters;
}

/**
 * 检查本地是否有角色缓存
 */
export async function hasLocalCharacter(
    key: CanvasCharacterStorageKey
): Promise<boolean> {
    const storageKey = getStorageKey(key);
    const data = await characterStorage.getItem(storageKey);
    return data !== null;
}

/**
 * 获取本地存储大小估算
 */
export async function getLocalStorageSize(): Promise<{
    characters: number;
    images: number;
    consistency: number;
    total: number;
}> {
    let characterSize = 0;
    let imageSize = 0;
    let consistencySize = 0;

    // 计算角色文档大小
    const characterKeys = await characterStorage.keys();
    for (const key of characterKeys) {
        const data = await characterStorage.getItem(key);
        if (data) {
            characterSize += JSON.stringify(data).length;
        }
    }

    // 计算图片缓存大小
    const imageKeys = await imageStorage.keys();
    for (const key of imageKeys) {
        const data = await imageStorage.getItem<any>(key);
        if (data) {
            if (data.blob && data.blob.size) {
                imageSize += data.blob.size;
            } else if (data.dataUrl) {
                imageSize += data.dataUrl.length;
            }
        }
    }

    // 计算一致性检查大小
    const consistencyKeys = await consistencyStorage.keys();
    for (const key of consistencyKeys) {
        const data = await consistencyStorage.getItem(key);
        if (data) {
            consistencySize += JSON.stringify(data).length;
        }
    }

    return {
        characters: characterSize,
        images: imageSize,
        consistency: consistencySize,
        total: characterSize + imageSize + consistencySize,
    };
}

/**
 * 清理过期的本地缓存（超过指定天数）
 */
export async function cleanupOldLocalCharacters(
    daysOld: number = 30
): Promise<{
    characters: number;
    images: number;
    consistency: number;
}> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let cleanedCharacters = 0;
    let cleanedImages = 0;
    let cleanedConsistency = 0;

    // 清理角色文档
    const characterKeys = await characterStorage.keys();
    for (const key of characterKeys) {
        const data = await characterStorage.getItem<any>(key);
        if (data && data._cachedAt) {
            const cachedDate = new Date(data._cachedAt);
            if (cachedDate < cutoffDate) {
                await characterStorage.removeItem(key);
                cleanedCharacters++;
            }
        }
    }

    // 清理图片
    const imageKeys = await imageStorage.keys();
    for (const key of imageKeys) {
        const data = await imageStorage.getItem<any>(key);
        if (data && data._cachedAt) {
            const cachedDate = new Date(data._cachedAt);
            if (cachedDate < cutoffDate) {
                await imageStorage.removeItem(key);
                cleanedImages++;
            }
        }
    }

    // 清理一致性检查
    const consistencyKeys = await consistencyStorage.keys();
    for (const key of consistencyKeys) {
        const data = await consistencyStorage.getItem<any>(key);
        if (data && data._updatedAt) {
            const updatedDate = new Date(data._updatedAt);
            if (updatedDate < cutoffDate) {
                await consistencyStorage.removeItem(key);
                cleanedConsistency++;
            }
        }
    }

    return {
        characters: cleanedCharacters,
        images: cleanedImages,
        consistency: cleanedConsistency,
    };
}
