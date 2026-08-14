"use client";

import { useState, useMemo } from "react";
import { Input, Select, Button, Tooltip, Popover } from "antd";
import { Search, SlidersHorizontal, SortAsc, Calendar, Tag as TagIcon } from "lucide-react";
import type { CharacterAssetType, CharacterListSortBy, CharacterListSortOrder } from "../../character-types";
import { CHARACTER_TYPE_OPTIONS } from "@/lib/canvas-character-asset-contract";

type CharacterSearchFilterProps = {
    keyword?: string;
    typeFilter?: CharacterAssetType | "all";
    tagFilter?: string[];
    sortBy?: CharacterListSortBy;
    sortOrder?: CharacterListSortOrder;
    availableTags?: string[];
    onKeywordChange?: (keyword: string) => void;
    onTypeFilterChange?: (type: CharacterAssetType | "all") => void;
    onTagFilterChange?: (tags: string[]) => void;
    onSortChange?: (sortBy: CharacterListSortBy, sortOrder: CharacterListSortOrder) => void;
    onReset?: () => void;
};

export function CharacterSearchFilter({
    keyword = "",
    typeFilter = "all",
    tagFilter = [],
    sortBy = "updated",
    sortOrder = "desc",
    availableTags = [],
    onKeywordChange,
    onTypeFilterChange,
    onTagFilterChange,
    onSortChange,
    onReset,
}: CharacterSearchFilterProps) {
    const [showFilters, setShowFilters] = useState(false);

    const sortOptions = [
        { label: "名称", value: "name" },
        { label: "创建时间", value: "created" },
        { label: "更新时间", value: "updated" },
        { label: "最后使用", value: "lastUsed" },
    ];

    const sortOrderOptions = [
        { label: "升序", value: "asc" },
        { label: "降序", value: "desc" },
    ];

    const hasActiveFilters = typeFilter !== "all" || tagFilter.length > 0 || sortBy !== "updated" || sortOrder !== "desc";

    const filterContent = (
        <div className="w-72 space-y-4">
            <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-700 dark:text-stone-300">角色类型</label>
                <Select
                    value={typeFilter}
                    onChange={onTypeFilterChange}
                    options={[{ label: "全部", value: "all" }, ...CHARACTER_TYPE_OPTIONS]}
                    className="w-full"
                    size="small"
                />
            </div>

            {availableTags.length > 0 && (
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-stone-700 dark:text-stone-300">标签</label>
                    <Select
                        mode="multiple"
                        value={tagFilter}
                        onChange={onTagFilterChange}
                        options={availableTags.map((tag) => ({ label: tag, value: tag }))}
                        placeholder="选择标签"
                        className="w-full"
                        size="small"
                        maxTagCount="responsive"
                    />
                </div>
            )}

            <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-700 dark:text-stone-300">排序方式</label>
                <div className="flex gap-2">
                    <Select value={sortBy} onChange={(value) => onSortChange?.(value, sortOrder)} options={sortOptions} className="flex-1" size="small" />
                    <Select value={sortOrder} onChange={(value) => onSortChange?.(sortBy, value)} options={sortOrderOptions} className="w-20" size="small" />
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button size="small" onClick={onReset}>
                    重置
                </Button>
                <Button type="primary" size="small" onClick={() => setShowFilters(false)}>
                    确定
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Input
                prefix={<Search className="size-4 text-stone-400" />}
                placeholder="搜索角色名称、描述"
                value={keyword}
                onChange={(e) => onKeywordChange?.(e.target.value)}
                allowClear
                size="small"
                className="w-full sm:w-64"
            />

            <Popover content={filterContent} trigger="click" open={showFilters} onOpenChange={setShowFilters} placement="bottomLeft">
                <Button size="small" icon={<SlidersHorizontal className="size-3.5" />} className={hasActiveFilters ? "border-blue-500 text-blue-600" : ""}>
                    筛选 {hasActiveFilters && `(${[typeFilter !== "all" ? 1 : 0, tagFilter.length].reduce((a, b) => a + b, 0)})`}
                </Button>
            </Popover>

            {hasActiveFilters && (
                <Tooltip title="清除所有筛选">
                    <Button size="small" onClick={onReset}>
                        清除
                    </Button>
                </Tooltip>
            )}
        </div>
    );
}
