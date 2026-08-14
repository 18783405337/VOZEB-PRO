"use client";

import { Card, Tag, Tooltip, Button, Dropdown } from "antd";
import { Eye, Edit, Copy, Trash2, Archive, MoreVertical, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterAsset } from "../../character-types";
import { CHARACTER_TYPE_LABELS } from "@/lib/canvas-character-asset-contract";
import { imagePreviewUrl } from "@/lib/media-image-url";

type CharacterPreviewCardProps = {
    character: CharacterAsset;
    size?: "small" | "medium" | "large";
    showActions?: boolean;
    showVersions?: boolean;
    onClick?: () => void;
    onEdit?: () => void;
    onCopy?: () => void;
    onArchive?: () => void;
    onDelete?: () => void;
    className?: string;
};

export function CharacterPreviewCard({
    character,
    size = "medium",
    showActions = true,
    showVersions = true,
    onClick,
    onEdit,
    onCopy,
    onArchive,
    onDelete,
    className,
}: CharacterPreviewCardProps) {
    const sizeClasses = {
        small: "w-48",
        medium: "w-64",
        large: "w-80",
    };

    const imageSize = {
        small: 200,
        medium: 300,
        large: 400,
    };

    const menuItems = [
        { key: "view", label: "查看详情", icon: <Eye className="size-3.5" />, onClick },
        { key: "edit", label: "编辑", icon: <Edit className="size-3.5" />, onClick: onEdit },
        { key: "copy", label: "复制", icon: <Copy className="size-3.5" />, onClick: onCopy },
        { type: "divider" as const },
        { key: "archive", label: "归档", icon: <Archive className="size-3.5" />, onClick: onArchive },
        { key: "delete", label: "删除", icon: <Trash2 className="size-3.5" />, danger: true, onClick: onDelete },
    ];

    return (
        <Card
            className={cn("group overflow-hidden transition-all hover:shadow-lg", sizeClasses[size], className)}
            cover={
                <div className="relative aspect-square overflow-hidden bg-stone-100 dark:bg-stone-900">
                    {character.thumbnailUrl || character.baseImageUrl ? (
                        <img
                            src={imagePreviewUrl(character.thumbnailUrl || character.baseImageUrl, imageSize[size])}
                            alt={character.name}
                            className="size-full object-cover transition-transform group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex size-full items-center justify-center text-6xl font-bold text-stone-300 dark:text-stone-600">{character.name.charAt(0).toUpperCase()}</div>
                    )}
                    {character.isArchived && (
                        <div className="absolute right-2 top-2 rounded bg-orange-500 px-2 py-1 text-xs font-medium text-white">已归档</div>
                    )}
                    {showVersions && character.versions.length > 1 && (
                        <Tooltip title={`${character.versions.length} 个版本`}>
                            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
                                <ImageIcon className="size-3" />
                                <span>{character.versions.length}</span>
                            </div>
                        </Tooltip>
                    )}
                    {showActions && (
                        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
                                <Button
                                    type="text"
                                    size="small"
                                    className="bg-white/90 backdrop-blur-sm dark:bg-stone-800/90"
                                    icon={<MoreVertical className="size-4" />}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </Dropdown>
                        </div>
                    )}
                </div>
            }
            bodyStyle={{ padding: "12px" }}
        >
            <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="line-clamp-1 text-sm font-semibold text-stone-900 dark:text-stone-100">{character.name}</h4>
                    <Tag className="m-0 shrink-0 text-[10px]">{CHARACTER_TYPE_LABELS[character.characterType]}</Tag>
                </div>

                {character.description && (
                    <p className="line-clamp-2 text-xs text-stone-600 dark:text-stone-400">{character.description}</p>
                )}

                <div className="flex items-center justify-between text-[10px] text-stone-500">
                    <span>版本 {character.currentVersion}</span>
                    <span>{new Date(character.updatedAt).toLocaleDateString()}</span>
                </div>

                {character.tags.length > 0 && (
                    <div className="hide-scrollbar flex gap-1 overflow-x-auto pt-1">
                        {character.tags.slice(0, 3).map((tag) => (
                            <Tag key={tag} className="m-0 text-[10px]">
                                {tag}
                            </Tag>
                        ))}
                        {character.tags.length > 3 && (
                            <Tooltip title={character.tags.slice(3).join(", ")}>
                                <span className="text-[10px] text-stone-400">+{character.tags.length - 3}</span>
                            </Tooltip>
                        )}
                    </div>
                )}

                {character.lastUsedAt && (
                    <div className="border-t border-stone-100 pt-2 text-[10px] text-stone-500 dark:border-stone-700">
                        最后使用: {new Date(character.lastUsedAt).toLocaleDateString()}
                    </div>
                )}
            </div>
        </Card>
    );
}
