"use client";

import { useState } from "react";
import { Modal, Button, Space, message } from "antd";
import { Copy, Trash2, Archive, FolderOpen, Download } from "lucide-react";
import type { CharacterAsset } from "../../character-types";

type CharacterBatchActionsProps = {
    selectedCharacters: CharacterAsset[];
    onCopy?: (ids: string[]) => Promise<void>;
    onArchive?: (ids: string[]) => Promise<void>;
    onDelete?: (ids: string[]) => Promise<void>;
    onExport?: (ids: string[]) => Promise<void>;
    onClearSelection?: () => void;
};

export function CharacterBatchActions({
    selectedCharacters,
    onCopy,
    onArchive,
    onDelete,
    onExport,
    onClearSelection,
}: CharacterBatchActionsProps) {
    const [loading, setLoading] = useState<string | null>(null);

    const handleCopy = async () => {
        if (!onCopy) return;
        setLoading("copy");
        try {
            await onCopy(selectedCharacters.map((c) => c.id));
            message.success(`已复制 ${selectedCharacters.length} 个角色`);
            onClearSelection?.();
        } catch (error) {
            message.error("复制失败");
        } finally {
            setLoading(null);
        }
    };

    const handleArchive = async () => {
        if (!onArchive) return;
        Modal.confirm({
            title: "归档角色",
            content: `确定要归档选中的 ${selectedCharacters.length} 个角色吗？归档后可以在归档列表中查看。`,
            onOk: async () => {
                setLoading("archive");
                try {
                    await onArchive(selectedCharacters.map((c) => c.id));
                    message.success(`已归档 ${selectedCharacters.length} 个角色`);
                    onClearSelection?.();
                } catch (error) {
                    message.error("归档失败");
                } finally {
                    setLoading(null);
                }
            },
        });
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        Modal.confirm({
            title: "删除角色",
            content: `确定要删除选中的 ${selectedCharacters.length} 个角色吗？此操作不可恢复。`,
            okText: "删除",
            okType: "danger",
            onOk: async () => {
                setLoading("delete");
                try {
                    await onDelete(selectedCharacters.map((c) => c.id));
                    message.success(`已删除 ${selectedCharacters.length} 个角色`);
                    onClearSelection?.();
                } catch (error) {
                    message.error("删除失败");
                } finally {
                    setLoading(null);
                }
            },
        });
    };

    const handleExport = async () => {
        if (!onExport) return;
        setLoading("export");
        try {
            await onExport(selectedCharacters.map((c) => c.id));
            message.success(`已导出 ${selectedCharacters.length} 个角色`);
        } catch (error) {
            message.error("导出失败");
        } finally {
            setLoading(null);
        }
    };

    if (selectedCharacters.length === 0) return null;

    return (
        <div className="flex items-center justify-between border-t border-stone-200 bg-blue-50 px-4 py-3 dark:border-stone-700 dark:bg-blue-900/20">
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    已选择 {selectedCharacters.length} 个角色
                </span>
                <Button type="link" size="small" onClick={onClearSelection}>
                    清除选择
                </Button>
            </div>

            <Space size="small">
                {onCopy && (
                    <Button
                        size="small"
                        icon={<Copy className="size-3.5" />}
                        loading={loading === "copy"}
                        onClick={handleCopy}
                    >
                        复制
                    </Button>
                )}
                {onExport && (
                    <Button
                        size="small"
                        icon={<Download className="size-3.5" />}
                        loading={loading === "export"}
                        onClick={handleExport}
                    >
                        导出
                    </Button>
                )}
                {onArchive && (
                    <Button
                        size="small"
                        icon={<Archive className="size-3.5" />}
                        loading={loading === "archive"}
                        onClick={handleArchive}
                    >
                        归档
                    </Button>
                )}
                {onDelete && (
                    <Button
                        size="small"
                        danger
                        icon={<Trash2 className="size-3.5" />}
                        loading={loading === "delete"}
                        onClick={handleDelete}
                    >
                        删除
                    </Button>
                )}
            </Space>
        </div>
    );
}
