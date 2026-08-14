/**
 * Canvas Drawing 存储工具
 *
 * 使用 LocalForage 存储绘图文档数据
 * 支持版本控制和自动保存
 */

import localforage from "localforage";
import type {
    CanvasDrawingDocument,
    CanvasDrawingVersion,
    CanvasDrawingStorageKey,
    CanvasDrawingStats,
} from "./drawing-types";
import type { CanvasDrawingEngine } from "./types";

// 创建专用的 LocalForage 实例
const drawingStore = localforage.createInstance({
    name: "canvas-drawings",
    storeName: "drawings",
    description: "Canvas drawing documents storage",
});

const versionStore = localforage.createInstance({
    name: "canvas-drawings",
    storeName: "versions",
    description: "Canvas drawing version history",
});

/**
 * 生成存储键
 */
function makeStorageKey(projectId: string, drawingId: string): string {
    return `${projectId}:${drawingId}`;
}

/**
 * 生成版本存储键
 */
function makeVersionKey(projectId: string, drawingId: string, revision: number): string {
    return `${projectId}:${drawingId}:v${revision}`;
}

/**
 * 保存绘图文档
 */
export async function saveDrawingDocument(document: CanvasDrawingDocument): Promise<void> {
    const key = makeStorageKey(document.projectId, document.drawingId);
    await drawingStore.setItem(key, document);

    // 保存版本历史
    const versionKey = makeVersionKey(document.projectId, document.drawingId, document.revision);
    const version: CanvasDrawingVersion = {
        revision: document.revision,
        snapshot: document.snapshot,
        createdAt: document.updatedAt,
    };
    await versionStore.setItem(versionKey, version);
}

/**
 * 获取绘图文档
 */
export async function getDrawingDocument(
    projectId: string,
    drawingId: string
): Promise<CanvasDrawingDocument | null> {
    const key = makeStorageKey(projectId, drawingId);
    return await drawingStore.getItem<CanvasDrawingDocument>(key);
}

/**
 * 删除绘图文档
 */
export async function deleteDrawingDocument(projectId: string, drawingId: string): Promise<void> {
    const key = makeStorageKey(projectId, drawingId);
    await drawingStore.removeItem(key);

    // 删除所有版本历史
    const versions = await listDrawingVersions(projectId, drawingId);
    await Promise.all(
        versions.map((v) =>
            versionStore.removeItem(makeVersionKey(projectId, drawingId, v.revision))
        )
    );
}

/**
 * 列出项目的所有绘图文档
 */
export async function listProjectDrawings(projectId: string): Promise<CanvasDrawingDocument[]> {
    const drawings: CanvasDrawingDocument[] = [];
    await drawingStore.iterate<CanvasDrawingDocument, void>((document, key) => {
        if (key.startsWith(`${projectId}:`)) {
            drawings.push(document);
        }
    });
    return drawings.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 获取绘图版本历史
 */
export async function listDrawingVersions(
    projectId: string,
    drawingId: string
): Promise<CanvasDrawingVersion[]> {
    const versions: CanvasDrawingVersion[] = [];
    const prefix = `${projectId}:${drawingId}:v`;

    await versionStore.iterate<CanvasDrawingVersion, void>((version, key) => {
        if (key.startsWith(prefix)) {
            versions.push(version);
        }
    });

    return versions.sort((a, b) => b.revision - a.revision);
}

/**
 * 获取特定版本
 */
export async function getDrawingVersion(
    projectId: string,
    drawingId: string,
    revision: number
): Promise<CanvasDrawingVersion | null> {
    const key = makeVersionKey(projectId, drawingId, revision);
    return await versionStore.getItem<CanvasDrawingVersion>(key);
}

/**
 * 创建新的绘图文档
 */
export async function createDrawingDocument(
    projectId: string,
    drawingId: string,
    engine: CanvasDrawingEngine,
    initialSnapshot?: unknown
): Promise<CanvasDrawingDocument> {
    const now = new Date().toISOString();
    const document: CanvasDrawingDocument = {
        drawingId,
        projectId,
        engine,
        snapshot: initialSnapshot || getDefaultSnapshot(engine),
        revision: 1,
        shapeCount: 0,
        pageCount: 1,
        createdAt: now,
        updatedAt: now,
    };

    await saveDrawingDocument(document);
    return document;
}

/**
 * 更新绘图文档
 */
export async function updateDrawingDocument(
    projectId: string,
    drawingId: string,
    snapshot: unknown,
    stats?: { shapeCount?: number; pageCount?: number }
): Promise<CanvasDrawingDocument> {
    const existing = await getDrawingDocument(projectId, drawingId);
    if (!existing) {
        throw new Error(`Drawing document not found: ${drawingId}`);
    }

    const updated: CanvasDrawingDocument = {
        ...existing,
        snapshot,
        revision: existing.revision + 1,
        shapeCount: stats?.shapeCount ?? existing.shapeCount,
        pageCount: stats?.pageCount ?? existing.pageCount,
        updatedAt: new Date().toISOString(),
    };

    await saveDrawingDocument(updated);
    return updated;
}

/**
 * 获取绘图统计信息
 */
export async function getDrawingStats(
    projectId: string,
    drawingId: string
): Promise<CanvasDrawingStats | null> {
    const document = await getDrawingDocument(projectId, drawingId);
    if (!document) return null;

    const versions = await listDrawingVersions(projectId, drawingId);
    const documentSize = new Blob([JSON.stringify(document.snapshot)]).size;

    return {
        shapeCount: document.shapeCount,
        pageCount: document.pageCount,
        documentSize,
        lastEditedAt: document.updatedAt,
        editCount: versions.length,
    };
}

/**
 * 清理旧版本（保留最近 N 个版本）
 */
export async function cleanupOldVersions(
    projectId: string,
    drawingId: string,
    keepCount: number = 10
): Promise<void> {
    const versions = await listDrawingVersions(projectId, drawingId);
    if (versions.length <= keepCount) return;

    const toDelete = versions.slice(keepCount);
    await Promise.all(
        toDelete.map((v) => versionStore.removeItem(makeVersionKey(projectId, drawingId, v.revision)))
    );
}

/**
 * 获取默认快照
 */
function getDefaultSnapshot(engine: CanvasDrawingEngine): unknown {
    switch (engine) {
        case "excalidraw":
            return {
                elements: [],
                appState: {
                    viewBackgroundColor: "#ffffff",
                },
            };
        case "tldraw":
            return {
                store: {},
                schema: {
                    schemaVersion: 1,
                    storeVersion: 4,
                },
            };
        default:
            return {};
    }
}

/**
 * 导出所有绘图文档（用于备份）
 */
export async function exportAllDrawings(): Promise<Record<string, CanvasDrawingDocument>> {
    const allDrawings: Record<string, CanvasDrawingDocument> = {};
    await drawingStore.iterate<CanvasDrawingDocument, void>((document, key) => {
        allDrawings[key] = document;
    });
    return allDrawings;
}

/**
 * 导入绘图文档（用于恢复）
 */
export async function importDrawings(drawings: Record<string, CanvasDrawingDocument>): Promise<void> {
    await Promise.all(
        Object.values(drawings).map((document) => saveDrawingDocument(document))
    );
}

/**
 * 清空所有绘图数据（谨慎使用）
 */
export async function clearAllDrawings(): Promise<void> {
    await drawingStore.clear();
    await versionStore.clear();
}
