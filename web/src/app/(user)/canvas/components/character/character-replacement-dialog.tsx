"use client";

import React, { useState } from "react";
import { AlertTriangle, RefreshCw, Settings, X } from "lucide-react";
import type { CharacterReplacementConfig } from "../../character-reference-types";
import type { CanvasCharacterDocument } from "../../character-types";

type CharacterReplacementDialogProps = {
    oldCharacter: CanvasCharacterDocument;
    availableCharacters: CanvasCharacterDocument[];
    affectedShots: Array<{
        shotId: string;
        shotNumber: number;
        sceneId: string;
        sceneName: string;
    }>;
    onReplace: (config: CharacterReplacementConfig) => Promise<void>;
    onClose: () => void;
};

/**
 * 角色替换对话框
 * 支持批量替换角色引用
 */
export function CharacterReplacementDialog({
    oldCharacter,
    availableCharacters,
    affectedShots,
    onReplace,
    onClose,
}: CharacterReplacementDialogProps) {
    const [newCharacterId, setNewCharacterId] = useState<string>("");
    const [scopeType, setScopeType] = useState<"all" | "selected">("all");
    const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set());
    const [updateDescriptions, setUpdateDescriptions] = useState(true);
    const [regenerateImages, setRegenerateImages] = useState(false);
    const [keepAppearanceNotes, setKeepAppearanceNotes] = useState(true);
    const [isReplacing, setIsReplacing] = useState(false);

    // 切换镜头选择
    const toggleShotSelection = (shotId: string) => {
        const newSelection = new Set(selectedShotIds);
        if (newSelection.has(shotId)) {
            newSelection.delete(shotId);
        } else {
            newSelection.add(shotId);
        }
        setSelectedShotIds(newSelection);
    };

    // 全选/取消全选
    const toggleSelectAll = () => {
        if (selectedShotIds.size === affectedShots.length) {
            setSelectedShotIds(new Set());
        } else {
            setSelectedShotIds(new Set(affectedShots.map(s => s.shotId)));
        }
    };

    // 执行替换
    const handleReplace = async () => {
        if (!newCharacterId) return;

        const config: CharacterReplacementConfig = {
            oldCharacterId: oldCharacter.characterId,
            newCharacterId,
            scope: {
                allShots: scopeType === "all",
                shotIds: scopeType === "selected" ? Array.from(selectedShotIds) : undefined,
            },
            options: {
                updateDescriptions,
                regenerateImages,
                keepAppearanceNotes,
            },
        };

        setIsReplacing(true);
        try {
            await onReplace(config);
            onClose();
        } catch (error) {
            console.error("Failed to replace character:", error);
        } finally {
            setIsReplacing(false);
        }
    };

    const selectedCharacter = availableCharacters.find(
        c => c.characterId === newCharacterId
    );

    const affectedShotsCount =
        scopeType === "all" ? affectedShots.length : selectedShotIds.size;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
                {/* 头部 */}
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                        <RefreshCw className="size-5 text-blue-500" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            替换角色
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* 内容 */}
                <div className="max-h-[70vh] space-y-4 overflow-auto p-4">
                    {/* 当前角色 */}
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">将要替换的角色</div>
                        <div className="mt-2 flex items-center gap-3">
                            {oldCharacter.referenceImages[0]?.serverUrl && (
                                <img
                                    src={oldCharacter.referenceImages[0].serverUrl}
                                    alt={oldCharacter.basicInfo.name}
                                    className="size-12 rounded object-cover"
                                />
                            )}
                            <div>
                                <div className="font-medium text-gray-900">
                                    {oldCharacter.basicInfo.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                    出现在 {affectedShots.length} 个镜头中
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 选择新角色 */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            替换为
                        </label>
                        <select
                            value={newCharacterId}
                            onChange={(e) => setNewCharacterId(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">选择角色...</option>
                            {availableCharacters.map((character) => (
                                <option key={character.characterId} value={character.characterId}>
                                    {character.basicInfo.name}
                                </option>
                            ))}
                        </select>

                        {/* 新角色预览 */}
                        {selectedCharacter && (
                            <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3">
                                <div className="flex items-center gap-3">
                                    {selectedCharacter.referenceImages[0]?.serverUrl && (
                                        <img
                                            src={selectedCharacter.referenceImages[0].serverUrl}
                                            alt={selectedCharacter.basicInfo.name}
                                            className="size-12 rounded object-cover"
                                        />
                                    )}
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">
                                            {selectedCharacter.basicInfo.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {selectedCharacter.appearance.visualDescription}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 替换范围 */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            替换范围
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={scopeType === "all"}
                                    onChange={() => setScopeType("all")}
                                    className="text-blue-600"
                                />
                                <span className="text-sm text-gray-700">
                                    全部镜头 ({affectedShots.length} 个)
                                </span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={scopeType === "selected"}
                                    onChange={() => setScopeType("selected")}
                                    className="text-blue-600"
                                />
                                <span className="text-sm text-gray-700">
                                    选定镜头
                                </span>
                            </label>
                        </div>

                        {/* 镜头选择列表 */}
                        {scopeType === "selected" && (
                            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs text-gray-600">
                                        已选择 {selectedShotIds.size} / {affectedShots.length}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={toggleSelectAll}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        {selectedShotIds.size === affectedShots.length
                                            ? "取消全选"
                                            : "全选"}
                                    </button>
                                </div>
                                <div className="max-h-40 space-y-1 overflow-auto">
                                    {affectedShots.map((shot) => (
                                        <label
                                            key={shot.shotId}
                                            className="flex items-center gap-2 rounded p-2 hover:bg-gray-100"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedShotIds.has(shot.shotId)}
                                                onChange={() => toggleShotSelection(shot.shotId)}
                                                className="text-blue-600"
                                            />
                                            <span className="text-xs text-gray-700">
                                                镜头 #{shot.shotNumber} - {shot.sceneName}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 替换选项 */}
                    <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Settings className="size-4" />
                            替换选项
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={updateDescriptions}
                                    onChange={(e) => setUpdateDescriptions(e.target.checked)}
                                    className="text-blue-600"
                                />
                                <span className="text-sm text-gray-700">
                                    更新镜头描述中的角色名称
                                </span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={regenerateImages}
                                    onChange={(e) => setRegenerateImages(e.target.checked)}
                                    className="text-blue-600"
                                />
                                <span className="text-sm text-gray-700">
                                    重新生成镜头图片
                                </span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={keepAppearanceNotes}
                                    onChange={(e) => setKeepAppearanceNotes(e.target.checked)}
                                    className="text-blue-600"
                                />
                                <span className="text-sm text-gray-700">
                                    保留外观备注
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* 警告 */}
                    {regenerateImages && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="size-5 text-amber-600" />
                                <div className="flex-1 text-xs text-amber-800">
                                    <div className="font-medium">注意</div>
                                    <div className="mt-1">
                                        重新生成图片将覆盖现有的镜头图片，此操作不可撤销。
                                        建议先保存当前版本的分镜。
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 底部操作栏 */}
                <div className="flex items-center justify-between border-t border-gray-200 p-4">
                    <div className="text-sm text-gray-600">
                        将影响 <span className="font-medium">{affectedShotsCount}</span> 个镜头
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isReplacing}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            onClick={handleReplace}
                            disabled={!newCharacterId || isReplacing || (scopeType === "selected" && selectedShotIds.size === 0)}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isReplacing ? "替换中..." : "确认替换"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
