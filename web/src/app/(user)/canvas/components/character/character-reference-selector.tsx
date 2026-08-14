"use client";

import React, { useState, useMemo } from "react";
import { X, ChevronDown, UserCircle, AlertCircle } from "lucide-react";
import type { CharacterReference, CharacterRoleInShot } from "../../character-reference-types";
import type { CanvasCharacterDocument } from "../../character-types";
import { getCharacterRoleLabel, getCharacterRoleColor } from "../../character-reference-types";

type CharacterReferenceSelectorProps = {
    projectId: string;
    storyboardNodeId: string;
    shotId: string;
    value: CharacterReference[];
    characters: CanvasCharacterDocument[];
    onChange: (refs: CharacterReference[]) => void;
    onOpenCharacterLibrary?: () => void;
};

/**
 * 角色引用选择器组件
 * 用于在分镜镜头中选择和管理角色引用
 */
export function CharacterReferenceSelector({
    projectId,
    storyboardNodeId,
    shotId,
    value,
    characters,
    onChange,
    onOpenCharacterLibrary,
}: CharacterReferenceSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingRef, setEditingRef] = useState<string | null>(null);

    // 可用角色列表（排除已添加的）
    const availableCharacters = useMemo(() => {
        const usedCharacterIds = new Set(value.map(ref => ref.characterId));
        return characters.filter(char => !usedCharacterIds.has(char.characterId));
    }, [characters, value]);

    // 添加角色引用
    const handleAddCharacter = (characterId: string) => {
        const newRef: CharacterReference = {
            id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            characterId,
            versionId: undefined,
            storyboardNodeId,
            shotId,
            roleInShot: "primary",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        onChange([...value, newRef]);
        setIsOpen(false);
    };

    // 移除角色引用
    const handleRemoveCharacter = (refId: string) => {
        onChange(value.filter(ref => ref.id !== refId));
    };

    // 更新角色角色
    const handleUpdateRole = (refId: string, roleInShot: CharacterRoleInShot) => {
        onChange(
            value.map(ref =>
                ref.id === refId
                    ? { ...ref, roleInShot, updatedAt: new Date().toISOString() }
                    : ref
            )
        );
        setEditingRef(null);
    };

    // 更新外观备注
    const handleUpdateNotes = (refId: string, notes: string) => {
        onChange(
            value.map(ref =>
                ref.id === refId
                    ? { ...ref, appearanceNotes: notes, updatedAt: new Date().toISOString() }
                    : ref
            )
        );
    };

    // 获取角色信息
    const getCharacter = (characterId: string) => {
        return characters.find(c => c.characterId === characterId);
    };

    return (
        <div className="relative w-full">
            {/* 已选择的角色标签 */}
            <div className="flex flex-wrap gap-1">
                {value.length === 0 ? (
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
                    >
                        <UserCircle className="size-3" />
                        <span>添加角色</span>
                    </button>
                ) : (
                    <>
                        {value.map((ref) => {
                            const character = getCharacter(ref.characterId);
                            if (!character) return null;

                            const roleColor = getCharacterRoleColor(ref.roleInShot);
                            const roleLabel = getCharacterRoleLabel(ref.roleInShot);

                            return (
                                <div
                                    key={ref.id}
                                    className="group relative flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                                    style={{ borderLeftColor: roleColor, borderLeftWidth: 3 }}
                                >
                                    {/* 角色缩略图 */}
                                    {character.referenceImages[0]?.serverUrl && (
                                        <img
                                            src={character.referenceImages[0].serverUrl}
                                            alt={character.basicInfo.name}
                                            className="size-5 rounded object-cover"
                                        />
                                    )}

                                    {/* 角色名称 */}
                                    <span className="font-medium text-gray-700">
                                        {character.basicInfo.name}
                                    </span>

                                    {/* 角色标签 */}
                                    <span
                                        className="rounded px-1 py-0.5 text-xs text-white"
                                        style={{ backgroundColor: roleColor }}
                                    >
                                        {roleLabel}
                                    </span>

                                    {/* 外观备注指示器 */}
                                    {ref.appearanceNotes && (
                                        <AlertCircle
                                            className="size-3 text-amber-500"
                                            title={ref.appearanceNotes}
                                        />
                                    )}

                                    {/* 移除按钮 */}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveCharacter(ref.id)}
                                        className="ml-1 rounded p-0.5 text-gray-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                                    >
                                        <X className="size-3" />
                                    </button>

                                    {/* 编辑面板 */}
                                    {editingRef === ref.id && (
                                        <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                                            {/* 角色选择 */}
                                            <div className="mb-2">
                                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                                    镜头角色
                                                </label>
                                                <div className="flex gap-1">
                                                    {(["primary", "secondary", "background"] as CharacterRoleInShot[]).map((role) => (
                                                        <button
                                                            key={role}
                                                            type="button"
                                                            onClick={() => handleUpdateRole(ref.id, role)}
                                                            className={`flex-1 rounded px-2 py-1 text-xs ${
                                                                ref.roleInShot === role
                                                                    ? "bg-blue-500 text-white"
                                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                            }`}
                                                        >
                                                            {getCharacterRoleLabel(role)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 外观备注 */}
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                                    外观备注
                                                </label>
                                                <textarea
                                                    value={ref.appearanceNotes || ""}
                                                    onChange={(e) => handleUpdateNotes(ref.id, e.target.value)}
                                                    placeholder="例如：穿着红色外套、戴眼镜..."
                                                    rows={2}
                                                    className="w-full resize-none rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>

                                            {/* 关闭按钮 */}
                                            <button
                                                type="button"
                                                onClick={() => setEditingRef(null)}
                                                className="mt-2 w-full rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                                            >
                                                关闭
                                            </button>
                                        </div>
                                    )}

                                    {/* 点击编辑 */}
                                    <button
                                        type="button"
                                        onClick={() => setEditingRef(editingRef === ref.id ? null : ref.id)}
                                        className="absolute inset-0 z-0"
                                        aria-label="编辑角色引用"
                                    />
                                </div>
                            );
                        })}

                        {/* 添加更多按钮 */}
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className="flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
                        >
                            <UserCircle className="size-3" />
                            <ChevronDown className="size-3" />
                        </button>
                    </>
                )}
            </div>

            {/* 下拉选择器 */}
            {isOpen && (
                <>
                    {/* 遮罩层 */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* 选项列表 */}
                    <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {availableCharacters.length === 0 ? (
                            <div className="p-4 text-center">
                                <p className="mb-2 text-xs text-gray-400">
                                    没有可用角色
                                </p>
                                {onOpenCharacterLibrary && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onOpenCharacterLibrary();
                                            setIsOpen(false);
                                        }}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        创建新角色
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="p-1">
                                {availableCharacters.map((character) => (
                                    <button
                                        key={character.characterId}
                                        type="button"
                                        onClick={() => handleAddCharacter(character.characterId)}
                                        className="flex w-full items-center gap-2 rounded p-2 text-left hover:bg-gray-50"
                                    >
                                        {/* 缩略图 */}
                                        {character.referenceImages[0]?.serverUrl ? (
                                            <img
                                                src={character.referenceImages[0].serverUrl}
                                                alt={character.basicInfo.name}
                                                className="size-8 rounded object-cover"
                                            />
                                        ) : (
                                            <div className="flex size-8 items-center justify-center rounded bg-gray-100">
                                                <UserCircle className="size-5 text-gray-400" />
                                            </div>
                                        )}

                                        {/* 信息 */}
                                        <div className="flex-1">
                                            <div className="text-xs font-medium text-gray-700">
                                                {character.basicInfo.name}
                                            </div>
                                            {character.basicInfo.characterType && (
                                                <div className="text-xs text-gray-400">
                                                    {character.basicInfo.characterType}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
