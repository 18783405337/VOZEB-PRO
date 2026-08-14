"use client";

import { Button, Card, Modal, Radio, Space, message } from "antd";
import { Clapperboard } from "lucide-react";
import { useState } from "react";
import type { SceneTemplate } from "@/lib/drama-scene-types";
import { defaultSceneTemplates } from "@/lib/drama-scene-utils";

interface SceneTemplatePickerProps {
    open: boolean;
    onClose: () => void;
    onSelectTemplate: (template: SceneTemplate) => void;
}

export function SceneTemplatePicker({ open, onClose, onSelectTemplate }: SceneTemplatePickerProps) {
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();

    const handleConfirm = () => {
        const template = defaultSceneTemplates.find((t) => t.id === selectedTemplateId);
        if (!template) {
            message.warning("请选择一个场景模板");
            return;
        }
        onSelectTemplate(template);
        onClose();
    };

    const categoryLabels: Record<SceneTemplate["category"], string> = {
        establishing: "建立镜头",
        dialogue: "对话场景",
        action: "动作场景",
        transition: "过渡场景",
        montage: "蒙太奇",
        custom: "自定义",
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <Clapperboard className="size-5" />
                    <span>选择场景模板</span>
                </div>
            }
            open={open}
            onOk={handleConfirm}
            onCancel={onClose}
            okText="使用模板"
            cancelText="取消"
            width={800}
        >
            <div className="py-4">
                <p className="text-sm text-muted-foreground mb-4">
                    场景模板可以帮助你快速创建常见的镜头组合，所有内容都可以后续修改
                </p>

                <Radio.Group
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full"
                >
                    <Space direction="vertical" className="w-full" size="middle">
                        {defaultSceneTemplates.map((template) => (
                            <Card
                                key={template.id}
                                size="small"
                                className={`cursor-pointer transition-all hover:shadow-md ${
                                    selectedTemplateId === template.id ? "ring-2 ring-primary" : ""
                                }`}
                                onClick={() => setSelectedTemplateId(template.id)}
                            >
                                <div className="flex items-start gap-3">
                                    <Radio value={template.id} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold">{template.name}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                                {categoryLabels[template.category]}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {template.shotTemplates.length} 个镜头
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {template.description}
                                        </p>
                                        <div className="space-y-1">
                                            {template.shotTemplates.map((shot, index) => (
                                                <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="font-mono text-xs">#{index + 1}</span>
                                                    <span>{shot.title}</span>
                                                    <span className="text-muted-foreground/60">·</span>
                                                    <span>{shot.description}</span>
                                                    <span className="text-muted-foreground/60">·</span>
                                                    <span>{shot.duration}s</span>
                                                    {shot.shotSize && (
                                                        <>
                                                            <span className="text-muted-foreground/60">·</span>
                                                            <span>{shot.shotSize}</span>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </Space>
                </Radio.Group>
            </div>
        </Modal>
    );
}
