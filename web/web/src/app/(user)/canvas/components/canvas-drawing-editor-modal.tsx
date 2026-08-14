"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal, Radio, Button, Space, message } from "antd";
import { Save, Download, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import type { CanvasDrawingEngine } from "../types";
import type { CanvasDrawingDocument } from "../drawing-types";
import {
    getDrawingDocument,
    updateDrawingDocument,
    createDrawingDocument,
} from "../utils/canvas-drawing-storage";

// 动态导入编辑器组件
const ExcalidrawEditor = dynamic(
    () => import("./canvas-drawing-excalidraw-editor").then((mod) => mod.ExcalidrawEditor),
    { ssr: false }
);

const TldrawEditor = dynamic(
    () => import("./canvas-drawing-tldraw-editor").then((mod) => mod.TldrawEditor),
    { ssr: false }
);

type CanvasDrawingEditorModalProps = {
    open: boolean;
    onClose: () => void;
    projectId: string;
    drawingId: string;
    initialEngine?: CanvasDrawingEngine;
    readOnly?: boolean;
};

export function CanvasDrawingEditorModal({
    open,
    onClose,
    projectId,
    drawingId,
    initialEngine = "tldraw",
    readOnly = false,
}: CanvasDrawingEditorModalProps) {
    const [document, setDocument] = useState<CanvasDrawingDocument | null>(null);
    const [engine, setEngine] = useState<CanvasDrawingEngine>(initialEngine);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [currentSnapshot, setCurrentSnapshot] = useState<unknown>(null);

    // 加载绘图文档
    useEffect(() => {
        if (!open) return;

        const loadDocument = async () => {
            setLoading(true);
            try {
                let doc = await getDrawingDocument(projectId, drawingId);

                if (!doc) {
                    // 创建新文档
                    doc = await createDrawingDocument(projectId, drawingId, engine);
                    message.success("已创建新的绘图文档");
                }

                setDocument(doc);
                setEngine(doc.engine);
                setCurrentSnapshot(doc.snapshot);
            } catch (error) {
                console.error("Failed to load drawing document:", error);
                message.error("加载绘图文档失败");
            } finally {
                setLoading(false);
            }
        };

        loadDocument();
    }, [open, projectId, drawingId, engine]);

    // 自动保存
    useEffect(() => {
        if (!hasChanges || !currentSnapshot || readOnly) return;

        const timer = setTimeout(() => {
            handleSave();
        }, 3000); // 3秒后自动保存

        return () => clearTimeout(timer);
    }, [hasChanges, currentSnapshot, readOnly]);

    // 保存文档
    const handleSave = useCallback(async () => {
        if (!currentSnapshot || readOnly) return;

        setSaving(true);
        try {
            const updated = await updateDrawingDocument(projectId, drawingId, currentSnapshot);
            setDocument(updated);
            setHasChanges(false);

            // 生成预览图
            try {
                const { generateAndSavePreview } = await import("../utils/canvas-drawing-preview");
                await generateAndSavePreview(projectId, drawingId, engine, currentSnapshot, {
                    width: 300,
                    height: 225,
                });
            } catch (previewError) {
                console.error("Failed to generate preview:", previewError);
                // 预览图生成失败不影响保存
            }

            message.success("保存成功");
        } catch (error) {
            console.error("Failed to save drawing:", error);
            message.error("保存失败");
        } finally {
            setSaving(false);
        }
    }, [projectId, drawingId, currentSnapshot, readOnly, engine]);

    // 处理数据变化
    const handleChange = useCallback((snapshot: unknown) => {
        setCurrentSnapshot(snapshot);
        setHasChanges(true);
    }, []);

    // 切换引擎
    const handleEngineChange = useCallback((newEngine: CanvasDrawingEngine) => {
        if (hasChanges) {
            Modal.confirm({
                title: "切换引擎",
                content: "切换引擎将丢失未保存的更改，是否继续？",
                onOk: () => {
                    setEngine(newEngine);
                    setHasChanges(false);
                },
            });
        } else {
            setEngine(newEngine);
        }
    }, [hasChanges]);

    // 导出
    const handleExport = useCallback(() => {
        if (!currentSnapshot) return;

        const dataStr = JSON.stringify(currentSnapshot, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `drawing-${drawingId}-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        message.success("导出成功");
    }, [currentSnapshot, drawingId]);

    // 关闭前检查
    const handleClose = useCallback(() => {
        if (hasChanges) {
            Modal.confirm({
                title: "未保存的更改",
                content: "您有未保存的更改，是否保存后关闭？",
                okText: "保存并关闭",
                cancelText: "放弃更改",
                onOk: async () => {
                    await handleSave();
                    onClose();
                },
                onCancel: () => {
                    onClose();
                },
            });
        } else {
            onClose();
        }
    }, [hasChanges, handleSave, onClose]);

    return (
        <Modal
            open={open}
            onCancel={handleClose}
            width="95%"
            style={{ top: 20 }}
            footer={null}
            destroyOnClose
        >
            <div className="flex flex-col h-[85vh]">
                {/* 工具栏 */}
                <div className="flex items-center justify-between p-4 border-b">
                    <Space>
                        <Radio.Group
                            value={engine}
                            onChange={(e) => handleEngineChange(e.target.value)}
                            disabled={readOnly}
                        >
                            <Radio.Button value="tldraw">Tldraw</Radio.Button>
                            <Radio.Button value="excalidraw">Excalidraw</Radio.Button>
                        </Radio.Group>

                        {hasChanges && (
                            <span className="text-sm text-orange-600">● 未保存</span>
                        )}
                    </Space>

                    <Space>
                        {!readOnly && (
                            <Button
                                icon={<Save className="w-4 h-4" />}
                                onClick={handleSave}
                                loading={saving}
                                disabled={!hasChanges}
                            >
                                保存
                            </Button>
                        )}
                        <Button
                            icon={<Download className="w-4 h-4" />}
                            onClick={handleExport}
                        >
                            导出
                        </Button>
                    </Space>
                </div>

                {/* 编辑器区域 */}
                <div className="flex-1 relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="mb-2">加载中...</div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {engine === "excalidraw" && document && (
                                <ExcalidrawEditor
                                    initialData={document.snapshot}
                                    onChange={handleChange}
                                    readOnly={readOnly}
                                />
                            )}
                            {engine === "tldraw" && document && (
                                <TldrawEditor
                                    initialData={document.snapshot}
                                    onChange={handleChange}
                                    readOnly={readOnly}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}
