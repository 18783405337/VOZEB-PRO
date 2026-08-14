"use client";

import { useState, useMemo } from "react";
import { Tag, Input, Button, Tooltip, Popover, message } from "antd";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CharacterTagManagerProps = {
    availableTags: string[];
    selectedTags?: string[];
    mode?: "view" | "edit" | "filter";
    onTagsChange?: (tags: string[]) => void;
    onCreateTag?: (tag: string) => Promise<void>;
    onDeleteTag?: (tag: string) => Promise<void>;
    maxTags?: number;
    className?: string;
};

export function CharacterTagManager({
    availableTags,
    selectedTags = [],
    mode = "view",
    onTagsChange,
    onCreateTag,
    onDeleteTag,
    maxTags,
    className,
}: CharacterTagManagerProps) {
    const [inputValue, setInputValue] = useState("");
    const [inputVisible, setInputVisible] = useState(false);

    const handleTagToggle = (tag: string) => {
        if (mode === "filter") {
            const newTags = selectedTags.includes(tag)
                ? selectedTags.filter((t) => t !== tag)
                : [...selectedTags, tag];
            onTagsChange?.(newTags);
        } else if (mode === "edit") {
            if (selectedTags.includes(tag)) {
                onTagsChange?.(selectedTags.filter((t) => t !== tag));
            } else {
                if (maxTags && selectedTags.length >= maxTags) {
                    message.warning(`最多只能添加 ${maxTags} 个标签`);
                    return;
                }
                onTagsChange?.([...selectedTags, tag]);
            }
        }
    };

    const handleCreateTag = async () => {
        const newTag = inputValue.trim();
        if (!newTag) return;

        if (availableTags.includes(newTag)) {
            message.warning("标签已存在");
            return;
        }

        if (newTag.length > 20) {
            message.warning("标签长度不能超过20个字符");
            return;
        }

        try {
            await onCreateTag?.(newTag);
            handleTagToggle(newTag);
            setInputValue("");
            setInputVisible(false);
            message.success("标签已创建");
        } catch (error) {
            message.error("创建失败");
        }
    };

    const handleDeleteTag = async (tag: string) => {
        try {
            await onDeleteTag?.(tag);
            onTagsChange?.(selectedTags.filter((t) => t !== tag));
            message.success("标签已删除");
        } catch (error) {
            message.error("删除失败");
        }
    };

    const sortedTags = useMemo(() => {
        const selected = availableTags.filter((tag) => selectedTags.includes(tag));
        const unselected = availableTags.filter((tag) => !selectedTags.includes(tag));
        return [...selected, ...unselected];
    }, [availableTags, selectedTags]);

    if (mode === "view") {
        return (
            <div className={cn("hide-scrollbar flex flex-wrap gap-1", className)}>
                {selectedTags.map((tag) => (
                    <Tag key={tag} className="m-0">
                        {tag}
                    </Tag>
                ))}
                {selectedTags.length === 0 && (
                    <span className="text-xs text-stone-400">暂无标签</span>
                )}
            </div>
        );
    }

    if (mode === "filter") {
        return (
            <div className={cn("hide-scrollbar flex flex-wrap gap-1.5", className)}>
                <div className="flex items-center gap-1 text-xs text-stone-500">
                    <TagIcon className="size-3.5" />
                    <span>标签筛选:</span>
                </div>
                {sortedTags.map((tag) => (
                    <Tag.CheckableTag
                        key={tag}
                        checked={selectedTags.includes(tag)}
                        onChange={() => handleTagToggle(tag)}
                        className={cn(
                            "cursor-pointer text-xs",
                            selectedTags.includes(tag) && "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20",
                        )}
                    >
                        {tag}
                    </Tag.CheckableTag>
                ))}
            </div>
        );
    }

    // Edit mode
    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">标签</label>
                {maxTags && (
                    <span className="text-xs text-stone-500">
                        {selectedTags.length} / {maxTags}
                    </span>
                )}
            </div>

            <div className="flex flex-wrap gap-1.5">
                {sortedTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                        <Tag
                            key={tag}
                            className={cn(
                                "m-0 cursor-pointer transition",
                                isSelected
                                    ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                                    : "hover:border-blue-300",
                            )}
                            onClick={() => handleTagToggle(tag)}
                            closeIcon={
                                onDeleteTag ? (
                                    <X
                                        className="size-3"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteTag(tag);
                                        }}
                                    />
                                ) : undefined
                            }
                            closable={!!onDeleteTag}
                        >
                            {tag}
                        </Tag>
                    );
                })}

                {inputVisible ? (
                    <Input
                        type="text"
                        size="small"
                        className="w-24"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleCreateTag}
                        onPressEnter={handleCreateTag}
                        autoFocus
                        maxLength={20}
                        placeholder="新标签"
                    />
                ) : (
                    onCreateTag && (
                        <Tooltip title="创建新标签">
                            <Button
                                type="dashed"
                                size="small"
                                icon={<Plus className="size-3" />}
                                onClick={() => setInputVisible(true)}
                                disabled={maxTags ? selectedTags.length >= maxTags : false}
                            >
                                新标签
                            </Button>
                        </Tooltip>
                    )
                )}
            </div>
        </div>
    );
}
