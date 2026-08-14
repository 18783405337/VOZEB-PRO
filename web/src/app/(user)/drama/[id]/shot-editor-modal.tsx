"use client";

import { Form, Input, InputNumber, Modal, Select, message } from "antd";
import { useState } from "react";
import type { DramaShot } from "@/lib/drama-project-contract";
import type { ShotMergeConfig, ShotSplitConfig } from "@/lib/drama-scene-types";

interface ShotEditorModalProps {
    open: boolean;
    mode: "split" | "merge";
    shots: DramaShot[];
    onClose: () => void;
    onSplit?: (config: ShotSplitConfig) => void;
    onMerge?: (config: ShotMergeConfig) => void;
}

export function ShotEditorModal({ open, mode, shots, onClose, onSplit, onMerge }: ShotEditorModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();

            if (mode === "split" && onSplit) {
                const config: ShotSplitConfig = {
                    shotId: values.shotId,
                    splitCount: values.splitCount,
                    distributeDuration: values.distributeDuration ?? true,
                };
                onSplit(config);
                message.success(`已将镜头分割为 ${config.splitCount} 个子镜头`);
            } else if (mode === "merge" && onMerge) {
                const config: ShotMergeConfig = {
                    shotIds: shots.map((s) => s.id),
                    mergedTitle: values.mergedTitle,
                    mergedDescription: values.mergedDescription,
                };
                onMerge(config);
                message.success(`已合并 ${shots.length} 个镜头`);
            }

            form.resetFields();
            onClose();
        } catch (error) {
            console.error("Failed to edit shot:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    const shotOptions = shots.map((shot) => ({
        label: `#${shot.order} - ${shot.title}`,
        value: shot.id,
    }));

    return (
        <Modal
            title={mode === "split" ? "分割镜头" : "合并镜头"}
            open={open}
            onOk={handleSubmit}
            onCancel={handleCancel}
            confirmLoading={loading}
            okText={mode === "split" ? "分割" : "合并"}
            cancelText="取消"
            width={500}
        >
            {mode === "split" ? (
                <Form form={form} layout="vertical" initialValues={{ splitCount: 2, distributeDuration: true }}>
                    <Form.Item
                        label="选择要分割的镜头"
                        name="shotId"
                        rules={[{ required: true, message: "请选择镜头" }]}
                    >
                        <Select
                            placeholder="选择镜头"
                            options={shotOptions}
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label as string).toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </Form.Item>

                    <Form.Item
                        label="分割数量"
                        name="splitCount"
                        rules={[
                            { required: true, message: "请输入分割数量" },
                            { type: "number", min: 2, max: 10, message: "分割数量必须在 2-10 之间" },
                        ]}
                    >
                        <InputNumber min={2} max={10} className="w-full" />
                    </Form.Item>

                    <Form.Item
                        label="时长分配"
                        name="distributeDuration"
                        rules={[{ required: true, message: "请选择时长分配方式" }]}
                    >
                        <Select
                            options={[
                                { label: "平均分配原镜头时长", value: true },
                                { label: "每个子镜头保持原时长", value: false },
                            ]}
                        />
                    </Form.Item>

                    <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
                        <p className="mb-1">分割说明：</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>镜头将被分割为多个子镜头（如 001 → 001A, 001B）</li>
                            <li>所有子镜头继承原镜头的属性</li>
                            <li>可选择平均分配时长或保持原时长</li>
                        </ul>
                    </div>
                </Form>
            ) : (
                <Form form={form} layout="vertical">
                    <div className="bg-muted/50 rounded-md p-3 mb-4">
                        <p className="text-sm text-muted-foreground mb-2">
                            将合并以下 {shots.length} 个镜头：
                        </p>
                        <ul className="space-y-1">
                            {shots.map((shot) => (
                                <li key={shot.id} className="text-sm">
                                    <span className="font-mono text-xs text-muted-foreground">#{shot.order}</span>{" "}
                                    {shot.title} <span className="text-xs text-muted-foreground">({shot.duration}s)</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <Form.Item label="合并后的标题" name="mergedTitle">
                        <Input placeholder="留空使用默认标题" />
                    </Form.Item>

                    <Form.Item label="合并后的描述" name="mergedDescription">
                        <Input.TextArea
                            placeholder="留空自动合并所有描述"
                            autoSize={{ minRows: 2, maxRows: 4 }}
                        />
                    </Form.Item>

                    <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
                        <p className="mb-1">合并说明：</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>对白和旁白将自动合并</li>
                            <li>时长将累加（最大20秒）</li>
                            <li>角色、道具、线索将去重合并</li>
                            <li>分镜图和生成状态将重置</li>
                        </ul>
                    </div>
                </Form>
            )}
        </Modal>
    );
}
