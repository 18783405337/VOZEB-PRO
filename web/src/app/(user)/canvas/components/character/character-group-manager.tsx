"use client";

import { useState } from "react";
import { Modal, Input, Form, ColorPicker, Button, message, List, Tag, Tooltip, Empty } from "antd";
import { FolderPlus, Folder, Edit, Trash2, Users } from "lucide-react";
import type { CharacterGroup } from "../../character-types";
import type { Color } from "antd/es/color-picker";

type CharacterGroupManagerProps = {
    groups: CharacterGroup[];
    onCreateGroup?: (group: Omit<CharacterGroup, "id" | "createdAt" | "updatedAt">) => Promise<void>;
    onUpdateGroup?: (id: string, group: Partial<CharacterGroup>) => Promise<void>;
    onDeleteGroup?: (id: string) => Promise<void>;
    onSelectGroup?: (group: CharacterGroup) => void;
};

export function CharacterGroupManager({
    groups,
    onCreateGroup,
    onUpdateGroup,
    onDeleteGroup,
    onSelectGroup,
}: CharacterGroupManagerProps) {
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<CharacterGroup | null>(null);
    const [form] = Form.useForm();

    const handleCreate = () => {
        setEditingGroup(null);
        form.resetFields();
        setEditModalOpen(true);
    };

    const handleEdit = (group: CharacterGroup) => {
        setEditingGroup(group);
        form.setFieldsValue({
            name: group.name,
            description: group.description,
            color: group.color || "#1890ff",
        });
        setEditModalOpen(true);
    };

    const handleDelete = (group: CharacterGroup) => {
        Modal.confirm({
            title: "删除分组",
            content: `确定要删除分组 "${group.name}" 吗？分组内的角色不会被删除。`,
            okText: "删除",
            okType: "danger",
            onOk: async () => {
                try {
                    await onDeleteGroup?.(group.id);
                    message.success("分组已删除");
                } catch (error) {
                    message.error("删除失败");
                }
            },
        });
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const groupData = {
                name: values.name,
                description: values.description,
                color: typeof values.color === "string" ? values.color : values.color?.toHexString(),
                characterIds: editingGroup?.characterIds || [],
            };

            if (editingGroup) {
                await onUpdateGroup?.(editingGroup.id, groupData);
                message.success("分组已更新");
            } else {
                await onCreateGroup?.(groupData);
                message.success("分组已创建");
            }
            setEditModalOpen(false);
        } catch (error) {
            console.error("Form validation failed:", error);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-stone-700 dark:text-stone-300">角色分组</h4>
                <Button
                    type="text"
                    size="small"
                    icon={<FolderPlus className="size-3.5" />}
                    onClick={handleCreate}
                >
                    新建分组
                </Button>
            </div>

            {groups.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无分组"
                    className="py-8"
                />
            ) : (
                <List
                    size="small"
                    dataSource={groups}
                    renderItem={(group) => (
                        <List.Item
                            className="cursor-pointer rounded px-2 transition hover:bg-stone-50 dark:hover:bg-stone-800"
                            onClick={() => onSelectGroup?.(group)}
                            actions={[
                                <Tooltip key="edit" title="编辑">
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<Edit className="size-3.5" />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(group);
                                        }}
                                    />
                                </Tooltip>,
                                <Tooltip key="delete" title="删除">
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<Trash2 className="size-3.5" />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(group);
                                        }}
                                    />
                                </Tooltip>,
                            ]}
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className="size-3 shrink-0 rounded"
                                    style={{ backgroundColor: group.color || "#1890ff" }}
                                />
                                <Folder className="size-4 text-stone-500" />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                                        {group.name}
                                    </div>
                                    {group.description && (
                                        <div className="text-xs text-stone-500">{group.description}</div>
                                    )}
                                </div>
                                <Tag className="m-0 text-xs">{group.characterIds.length}</Tag>
                            </div>
                        </List.Item>
                    )}
                />
            )}

            <Modal
                title={editingGroup ? "编辑分组" : "新建分组"}
                open={editModalOpen}
                onCancel={() => setEditModalOpen(false)}
                onOk={handleSubmit}
                destroyOnClose
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item
                        name="name"
                        label="分组名称"
                        rules={[{ required: true, message: "请输入分组名称" }]}
                    >
                        <Input placeholder="例如：主角、配角、NPC" />
                    </Form.Item>

                    <Form.Item name="description" label="描述">
                        <Input.TextArea
                            placeholder="分组描述（可选）"
                            rows={3}
                            maxLength={200}
                            showCount
                        />
                    </Form.Item>

                    <Form.Item name="color" label="标识颜色" initialValue="#1890ff">
                        <ColorPicker showText />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
