"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal, Tabs, Drawer, Button, message } from "antd";
import { Users, FolderOpen, Archive as ArchiveIcon, Settings } from "lucide-react";
import type { CharacterAsset, CharacterAssetType, CharacterGroup, CharacterListSortBy, CharacterListSortOrder } from "../../character-types";
import { CharacterAssetLibrary } from "./character-asset-library";
import { CharacterGroupManager } from "./character-group-manager";
import { CharacterSearchFilter } from "./character-search-filter";
import { CharacterBatchActions } from "./character-batch-actions";

type CharacterAssetManagerProps = {
    open: boolean;
    mode?: "select" | "manage";
    selectionMode?: "single" | "multiple";
    selectedIds?: string[];
    onSelect?: (characters: CharacterAsset[]) => void;
    onClose?: () => void;
};

export function CharacterAssetManager({
    open,
    mode = "manage",
    selectionMode = "single",
    selectedIds = [],
    onSelect,
    onClose,
}: CharacterAssetManagerProps) {
    const [activeTab, setActiveTab] = useState<"library" | "groups" | "archived">("library");
    const [characters, setCharacters] = useState<CharacterAsset[]>([]);
    const [groups, setGroups] = useState<CharacterGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>(selectedIds);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Filter states
    const [keyword, setKeyword] = useState("");
    const [typeFilter, setTypeFilter] = useState<CharacterAssetType | "all">("all");
    const [tagFilter, setTagFilter] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<CharacterListSortBy>("updated");
    const [sortOrder, setSortOrder] = useState<CharacterListSortOrder>("desc");

    // Load data
    useEffect(() => {
        if (!open) return;
        loadCharacters();
        loadGroups();
    }, [open, keyword, typeFilter, tagFilter, sortBy, sortOrder, activeTab]);

    const loadCharacters = async () => {
        setLoading(true);
        try {
            // TODO: Replace with actual API call
            await new Promise((resolve) => setTimeout(resolve, 500));
            setCharacters([]);
        } catch (error) {
            message.error("加载失败");
        } finally {
            setLoading(false);
        }
    };

    const loadGroups = async () => {
        try {
            // TODO: Replace with actual API call
            setGroups([]);
        } catch (error) {
            console.error("Failed to load groups:", error);
        }
    };

    const handleResetFilters = () => {
        setKeyword("");
        setTypeFilter("all");
        setTagFilter([]);
        setSortBy("updated");
        setSortOrder("desc");
    };

    const handleBatchCopy = async (ids: string[]) => {
        // TODO: Implement copy logic
        console.log("Copy characters:", ids);
    };

    const handleBatchArchive = async (ids: string[]) => {
        // TODO: Implement archive logic
        console.log("Archive characters:", ids);
    };

    const handleBatchDelete = async (ids: string[]) => {
        // TODO: Implement delete logic
        console.log("Delete characters:", ids);
    };

    const handleBatchExport = async (ids: string[]) => {
        // TODO: Implement export logic
        console.log("Export characters:", ids);
    };

    const handleCreateGroup = async (group: Omit<CharacterGroup, "id" | "createdAt" | "updatedAt">) => {
        // TODO: Implement create group logic
        console.log("Create group:", group);
    };

    const handleUpdateGroup = async (id: string, group: Partial<CharacterGroup>) => {
        // TODO: Implement update group logic
        console.log("Update group:", id, group);
    };

    const handleDeleteGroup = async (id: string) => {
        // TODO: Implement delete group logic
        console.log("Delete group:", id);
    };

    const handleSelectGroup = (group: CharacterGroup) => {
        // Filter characters by group
        const groupCharacterIds = new Set(group.characterIds);
        setActiveTab("library");
    };

    const handleConfirmSelection = () => {
        const selected = characters.filter((c) => selectedCharacters.includes(c.id));
        onSelect?.(selected);
    };

    const allTags = Array.from(new Set(characters.flatMap((c) => c.tags)));
    const selectedCharacterObjects = characters.filter((c) => selectedCharacters.includes(c.id));

    const tabItems = [
        {
            key: "library",
            label: (
                <span className="flex items-center gap-2">
                    <Users className="size-4" />
                    角色库
                </span>
            ),
            children: (
                <div className="flex h-full flex-col">
                    <div className="border-b border-stone-200 p-4 dark:border-stone-700">
                        <CharacterSearchFilter
                            keyword={keyword}
                            typeFilter={typeFilter}
                            tagFilter={tagFilter}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            availableTags={allTags}
                            onKeywordChange={setKeyword}
                            onTypeFilterChange={setTypeFilter}
                            onTagFilterChange={setTagFilter}
                            onSortChange={(by, order) => {
                                setSortBy(by);
                                setSortOrder(order);
                            }}
                            onReset={handleResetFilters}
                        />
                    </div>
                    <div className="flex-1">
                        <CharacterAssetLibrary
                            open={open}
                            selectedIds={selectedCharacters}
                            selectionMode={mode === "select" ? selectionMode : "multiple"}
                            onSelect={
                                mode === "select" && selectionMode === "single"
                                    ? (character) => onSelect?.([character])
                                    : undefined
                            }
                            onSelectionChange={setSelectedCharacters}
                        />
                    </div>
                    {mode === "manage" && (
                        <CharacterBatchActions
                            selectedCharacters={selectedCharacterObjects}
                            onCopy={handleBatchCopy}
                            onArchive={handleBatchArchive}
                            onDelete={handleBatchDelete}
                            onExport={handleBatchExport}
                            onClearSelection={() => setSelectedCharacters([])}
                        />
                    )}
                </div>
            ),
        },
        {
            key: "groups",
            label: (
                <span className="flex items-center gap-2">
                    <FolderOpen className="size-4" />
                    分组管理
                </span>
            ),
            children: (
                <div className="p-4">
                    <CharacterGroupManager
                        groups={groups}
                        onCreateGroup={handleCreateGroup}
                        onUpdateGroup={handleUpdateGroup}
                        onDeleteGroup={handleDeleteGroup}
                        onSelectGroup={handleSelectGroup}
                    />
                </div>
            ),
        },
        {
            key: "archived",
            label: (
                <span className="flex items-center gap-2">
                    <ArchiveIcon className="size-4" />
                    已归档
                </span>
            ),
            children: (
                <div className="p-4">
                    <CharacterAssetLibrary
                        open={open && activeTab === "archived"}
                        selectedIds={[]}
                        selectionMode="multiple"
                    />
                </div>
            ),
        },
    ];

    return (
        <Modal
            title={
                <div className="flex items-center justify-between">
                    <span>{mode === "select" ? "选择角色" : "角色资产管理"}</span>
                    {mode === "manage" && (
                        <Button
                            type="text"
                            size="small"
                            icon={<Settings className="size-4" />}
                            onClick={() => setSettingsOpen(true)}
                        >
                            设置
                        </Button>
                    )}
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={
                mode === "select" && selectionMode === "multiple" ? (
                    <div className="flex justify-end gap-2">
                        <Button onClick={onClose}>取消</Button>
                        <Button
                            type="primary"
                            onClick={handleConfirmSelection}
                            disabled={selectedCharacters.length === 0}
                        >
                            确定选择 ({selectedCharacters.length})
                        </Button>
                    </div>
                ) : null
            }
            width={1200}
            styles={{ body: { height: "75vh", padding: 0 } }}
            destroyOnClose
        >
            <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as typeof activeTab)}
                items={mode === "manage" ? tabItems : [tabItems[0]]}
                className="h-full"
                tabBarStyle={{ margin: 0, paddingLeft: 16, paddingRight: 16 }}
            />
        </Modal>
    );
}
