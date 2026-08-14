"use client";

import { Button, Form, Input, Modal, Select, message } from "antd";
import { useState } from "react";
import type { SceneGroup, SceneGroupColor, SceneTransitionType } from "@/lib/drama-scene-types";
import { createSceneGroup, sceneColorMap } from "@/lib/drama-scene-utils";

interface CreateSceneModalProps {
    open: boolean;
    onClose: () => void;
    onCreateScene: (scene: SceneGroup) => void;
    selectedShotIds?: string[];
    nextOrder: number;
}

export function CreateSceneModal({ open, onClose, onCreateScene, selectedShotIds = [], nextOrder }: CreateSceneModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();

            const newScene = createSceneGroup({
                name: values.name,
                description: values.description || "",
                color: values.color || "blue",
                shotIds: selectedShotIds,
                location: values.location,
                timeOfDay: values.timeOfDay,
                weather: values.weather,
                lighting: values.lighting,
                order: nextOrder,
            });

            if (values.transitionType) {
                newScene.transition = {
                    type: values.transitionType,
                    duration: values.transitionDuration || 0,
                    description: values.transitionDescription,
                };
            }

            onCreateScene(newScene);
            message.success("场景创建成功");
            form.resetFields();
            onClose();
        } catch (error) {
            console.error("Failed to create scene:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    const colorOptions = Object.entries(sceneColorMap).map(([key, value]) => ({
        label: (
            <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${value.bg} border ${value.border}`} />
                <span>{key}</span>
            </div>
        ),
        value: key,
    }));

    const transitionOptions: { label: string; value: SceneTransitionType }[] = [
        { label: "切（直接切换）", value: "cut" },
        { label: "淡入淡出", value: "fade" },
        { label: "溶解", value: "dissolve" },
        { label: "划像", value: "wipe" },
        { label: "缩放", value: "zoom" },
        { label: "自定义", value: "custom" },
    ];

    return (
        <Modal
            title="创建场景分组"
            open={open}
            onOk={handleSubmit}
            onCancel={handleCancel}
            confirmLoading={loading}
            okText="创建"
            cancelText="取消"
            width={600}
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    color: "blue",
                    transitionType: "cut",
                    transitionDuration: 0,
                }}
            >
                <Form.Item
                    label="场景名称"
                    name="name"
                    rules={[{ required: true, message: "请输入场景名称" }]}
                >
                    <Input placeholder="例如：开场建立、对话场景、追逐戏" />
                </Form.Item>

                <Form.Item
                    label="场景描述"
                    name="description"
                >
                    <Input.TextArea
                        placeholder="简要描述这个场景的内容和目的"
                        autoSize={{ minRows: 2, maxRows: 4 }}
                    />
                </Form.Item>

                <div className="grid grid-cols-2 gap-3">
                    <Form.Item label="标识颜色" name="color">
                        <Select options={colorOptions} />
                    </Form.Item>

                    <Form.Item label="拍摄地点" name="location">
                        <Input placeholder="例如：客厅、街道" />
                    </Form.Item>

                    <Form.Item label="时间段" name="timeOfDay">
                        <Select
                            placeholder="选择时间"
                            options={[
                                { label: "清晨", value: "清晨" },
                                { label: "上午", value: "上午" },
                                { label: "中午", value: "中午" },
                                { label: "下午", value: "下午" },
                                { label: "黄昏", value: "黄昏" },
                                { label: "夜晚", value: "夜晚" },
                                { label: "深夜", value: "深夜" },
                            ]}
                        />
                    </Form.Item>

                    <Form.Item label="天气" name="weather">
                        <Select
                            placeholder="选择天气"
                            options={[
                                { label: "晴天", value: "晴天" },
                                { label: "多云", value: "多云" },
                                { label: "阴天", value: "阴天" },
                                { label: "雨天", value: "雨天" },
                                { label: "雪天", value: "雪天" },
                                { label: "雾天", value: "雾天" },
                            ]}
                        />
                    </Form.Item>

                    <Form.Item label="光线" name="lighting">
                        <Select
                            placeholder="选择光线"
                            options={[
                                { label: "自然光", value: "自然光" },
                                { label: "顶光", value: "顶光" },
                                { label: "侧光", value: "侧光" },
                                { label: "逆光", value: "逆光" },
                                { label: "低光", value: "低光" },
                                { label: "霓虹灯", value: "霓虹灯" },
                            ]}
                        />
                    </Form.Item>

                    <Form.Item label="转场类型" name="transitionType">
                        <Select options={transitionOptions} />
                    </Form.Item>
                </div>

                <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) => prevValues.transitionType !== currentValues.transitionType}
                >
                    {({ getFieldValue }) => {
                        const transitionType = getFieldValue("transitionType");
                        return transitionType && transitionType !== "cut" ? (
                            <div className="grid grid-cols-2 gap-3">
                                <Form.Item label="转场时长（秒）" name="transitionDuration">
                                    <Input type="number" min={0} max={5} step={0.1} />
                                </Form.Item>
                                <Form.Item label="转场说明" name="transitionDescription">
                                    <Input placeholder="可选" />
                                </Form.Item>
                            </div>
                        ) : null;
                    }}
                </Form.Item>

                {selectedShotIds.length > 0 && (
                    <div className="bg-muted/50 rounded-md p-3 text-sm">
                        <span className="text-muted-foreground">
                            已选择 {selectedShotIds.length} 个镜头将被加入此场景
                        </span>
                    </div>
                )}
            </Form>
        </Modal>
    );
}
