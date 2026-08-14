"use client";

import { useEffect, useState, useCallback } from "react";
import { Empty, Input, Spin, Tag, Button, Dropdown, Segmented, Tooltip } from "antd";
import { Search, Grid3x3, List, Filter, Plus, Copy, Trash2, Archive, MoreVertical, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterAsset, CharacterAssetType, CharacterViewMode } from "../../character-types";
import { CHARACTER_TYPE_LABELS } from "@/lib/canvas-character-asset-contract";
import { imagePreviewUrl } from "@/lib/media-image-url";

type CharacterAssetLibraryProps = {
    open: boolean;
    selectedIds?: string[];
    selectionMode?: "single" | "multiple";
    onSelect?: (character: CharacterAsset) => void;
    onSelectionChange?: (selectedIds: string[]) => void;
    onClose?: () => void;
    className?: string;
};

export function CharacterAssetLibrary({
    open,
    selectedIds = [],
    selectionMode = "single",
    onSelect,
    onSelectionChange,
    className,
}: CharacterAssetLibraryProps) {
    const [characters, setCharacters] = useState<CharacterAsset[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<CharacterViewMode>("grid");
    const [keyword, setKeyword] = useState("");
    const [typeFilter, setTypeFilter] = useState<CharacterAssetType | "all">("all");
    const [tagFilter, setTagFilter] = useState<string[]>([]);
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>(selectedIds);

    // Load characters
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        // TODO: Replace with actual API call
        setTimeout(() => {
            setCharacters([]);
            setLoading(false);
        }, 500);
    }, [open, keyword, typeFilter, tagFilter]);

    const handleCharacterClick = useCallback(
        (character: CharacterAsset) => {
            if (selectionMode === "single") {
                onSelect?.(character);
            } else {
                const newSelection = selectedCharacters.includes(character.id)
                    ? selectedCharacters.filter((id) => id !== character.id)
                    : [...selectedCharacters, character.id];
                setSelectedCharacters(newSelection);
                onSelectionChange?.(newSelection);
            }
        },
        [selectionMode, selectedCharacters, onSelect, onSelectionChange],
    );

    const typeOptions = [
        { label: "全部", value: "all" },
        ...Object.entries(CHARACTER_TYPE_LABELS).map(([value, label]) => ({ label, value })),
    ];

    const allTags = Array.from(new Set(characters.flatMap((c) => c.tags)));

    return (
        <div className={cn("flex h-full flex-col bg-white dark:bg-stone-900", className)}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
                <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">角色资产库</h3>
                    <span className="text-xs text-stone-500">{characters.length} 个角色</span>
                </div>
                <div className="flex items-center gap-2">
                    <Segmented
                        value={viewMode}
                        onChange={(value) => setViewMode(value as CharacterViewMode)}
                        options={[
                            { label: <Grid3x3 className="size-4" />, value: "grid" },
                            { label: <List className="size-4" />, value: "list" },
                        ]}
                        size="small"
                    />
                    <Button type="primary" size="small" icon={<Plus className="size-3.5" />}>
                        新建角色
                    </Button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-3 border-b border-stone-200 p-4 dark:border-stone-700">
                <Input
                    prefix={<Search className="size-4 text-stone-400" />}
                    placeholder="搜索角色名称、描述或标签"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    allowClear
                    size="small"
                />
                <div className="flex flex-wrap items-center gap-2">
                    <Filter className="size-4 text-stone-500" />
                    <div className="hide-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
                        {typeOptions.map((opt) => (
                            <Tag.CheckableTag
                                key={opt.value}
                                checked={typeFilter === opt.value}
                                className={cn("cursor-pointer rounded px-2 py-0.5 text-xs", typeFilter === opt.value && "bg-blue-500 text-white")}
                                onChange={() => setTypeFilter(opt.value as CharacterAssetType | "all")}
                            >
                                {opt.label}
                            </Tag.CheckableTag>
                        ))}
                    </div>
                </div>
                {allTags.length > 0 && (
                    <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
                        {allTags.map((tag) => (
                            <Tag.CheckableTag
                                key={tag}
                                checked={tagFilter.includes(tag)}
                                className={cn("cursor-pointer text-xs", tagFilter.includes(tag) && "border-blue-500 text-blue-600")}
                                onChange={(checked) => {
                                    setTagFilter(checked ? [...tagFilter, tag] : tagFilter.filter((t) => t !== tag));
                                }}
                            >
                                {tag}
                            </Tag.CheckableTag>
                        ))}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="grid min-h-64 place-items-center">
                        <Spin description="加载角色中" />
                    </div>
                ) : characters.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无角色资产" className="mt-16">
                        <Button type="primary" icon={<Plus className="size-4" />}>
                            创建第一个角色
                        </Button>
                    </Empty>
                ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {characters.map((character) => (
                            <CharacterCard
                                key={character.id}
                                character={character}
                                selected={selectedCharacters.includes(character.id)}
                                onClick={() => handleCharacterClick(character)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {characters.map((character) => (
                            <CharacterListItem
                                key={character.id}
                                character={character}
                                selected={selectedCharacters.includes(character.id)}
                                onClick={() => handleCharacterClick(character)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Batch Actions */}
            {selectionMode === "multiple" && selectedCharacters.length > 0 && (
                <div className="flex items-center justify-between border-t border-stone-200 bg-blue-50 px-4 py-3 dark:border-stone-700 dark:bg-blue-900/20">
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">已选择 {selectedCharacters.length} 个角色</span>
                    <div className="flex gap-2">
                        <Button size="small" icon={<Copy className="size-3.5" />}>
                            复制
                        </Button>
                        <Button size="small" icon={<Archive className="size-3.5" />}>
                            归档
                        </Button>
                        <Button size="small" danger icon={<Trash2 className="size-3.5" />}>
                            删除
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

type CharacterCardProps = {
    character: CharacterAsset;
    selected?: boolean;
    onClick?: () => void;
};

function CharacterCard({ character, selected, onClick }: CharacterCardProps) {
    const contextMenuItems = [
        { key: "edit", label: "编辑", icon: <FolderOpen className="size-3.5" /> },
        { key: "copy", label: "复制", icon: <Copy className="size-3.5" /> },
        { key: "archive", label: "归档", icon: <Archive className="size-3.5" /> },
        { type: "divider" as const },
        { key: "delete", label: "删除", danger: true, icon: <Trash2 className="size-3.5" /> },
    ];

    return (
        <div
            className={cn(
                "group relative cursor-pointer overflow-hidden rounded-lg border bg-white transition hover:shadow-md dark:bg-stone-800",
                selected ? "border-blue-500 ring-2 ring-blue-500/50" : "border-stone-200 hover:border-stone-400 dark:border-stone-700 dark:hover:border-stone-500",
            )}
            onClick={onClick}
        >
            <div className="aspect-square w-full overflow-hidden bg-stone-100 dark:bg-stone-900">
                {character.thumbnailUrl || character.baseImageUrl ? (
                    <img src={imagePreviewUrl(character.thumbnailUrl || character.baseImageUrl, 400)} alt={character.name} className="size-full object-cover" />
                ) : (
                    <div className="flex size-full items-center justify-center text-4xl font-bold text-stone-300 dark:text-stone-600">{character.name.charAt(0).toUpperCase()}</div>
                )}
            </div>
            <div className="p-2.5">
                <div className="mb-1 flex items-start justify-between gap-2">
                    <h4 className="line-clamp-1 text-sm font-medium text-stone-900 dark:text-stone-100">{character.name}</h4>
                    <Dropdown menu={{ items: contextMenuItems }} trigger={["click"]}>
                        <button type="button" className="shrink-0 rounded p-0.5 opacity-0 transition hover:bg-stone-100 group-hover:opacity-100 dark:hover:bg-stone-700" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="size-3.5 text-stone-500" />
                        </button>
                    </Dropdown>
                </div>
                <div className="mb-2 flex items-center gap-1.5">
                    <Tag className="m-0 text-[10px]">{CHARACTER_TYPE_LABELS[character.characterType]}</Tag>
                    <span className="text-[10px] text-stone-500">v{character.currentVersion}</span>
                </div>
                {character.tags.length > 0 && (
                    <div className="hide-scrollbar flex gap-1 overflow-x-auto">
                        {character.tags.slice(0, 3).map((tag) => (
                            <Tag key={tag} className="m-0 text-[10px]">
                                {tag}
                            </Tag>
                        ))}
                        {character.tags.length > 3 && <span className="text-[10px] text-stone-400">+{character.tags.length - 3}</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

type CharacterListItemProps = {
    character: CharacterAsset;
    selected?: boolean;
    onClick?: () => void;
};

function CharacterListItem({ character, selected, onClick }: CharacterListItemProps) {
    return (
        <div
            className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border bg-white p-3 transition hover:shadow-sm dark:bg-stone-800",
                selected ? "border-blue-500 ring-2 ring-blue-500/50" : "border-stone-200 hover:border-stone-300 dark:border-stone-700",
            )}
            onClick={onClick}
        >
            <div className="size-16 shrink-0 overflow-hidden rounded bg-stone-100 dark:bg-stone-900">
                {character.thumbnailUrl || character.baseImageUrl ? (
                    <img src={imagePreviewUrl(character.thumbnailUrl || character.baseImageUrl, 200)} alt={character.name} className="size-full object-cover" />
                ) : (
                    <div className="flex size-full items-center justify-center text-xl font-bold text-stone-300">{character.name.charAt(0).toUpperCase()}</div>
                )}
            </div>
            <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                    <h4 className="font-medium text-stone-900 dark:text-stone-100">{character.name}</h4>
                    <Tag className="m-0 text-xs">{CHARACTER_TYPE_LABELS[character.characterType]}</Tag>
                    <span className="text-xs text-stone-500">v{character.currentVersion}</span>
                </div>
                {character.description && <p className="mb-1.5 line-clamp-1 text-xs text-stone-600 dark:text-stone-400">{character.description}</p>}
                {character.tags.length > 0 && (
                    <div className="hide-scrollbar flex gap-1 overflow-x-auto">
                        {character.tags.map((tag) => (
                            <Tag key={tag} className="m-0 text-[10px]">
                                {tag}
                            </Tag>
                        ))}
                    </div>
                )}
            </div>
            <div className="shrink-0 text-xs text-stone-500">
                <div>更新于 {new Date(character.updatedAt).toLocaleDateString()}</div>
                {character.lastUsedAt && <div className="text-[10px]">使用于 {new Date(character.lastUsedAt).toLocaleDateString()}</div>}
            </div>
        </div>
    );
}
