"use client";

import { useState, useEffect } from "react";
import { FileImage, Edit } from "lucide-react";
import { Button } from "antd";
import type { CanvasNodeData } from "../types";
import { getDrawingDocument } from "../utils/canvas-drawing-storage";
import { CanvasDrawingEditorModal } from "./canvas-drawing-editor-modal";

type CanvasDrawingNodeProps = {
    node: CanvasNodeData;
    projectId: string;
    selected?: boolean;
    onEdit?: () => void;
};

export function CanvasDrawingNode({ node, projectId, selected, onEdit }: CanvasDrawingNodeProps) {
    const [editorOpen, setEditorOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const drawingId = node.metadata?.drawingId;
    const engine = node.metadata?.drawingEngine || "tldraw";
    const shapeCount = node.metadata?.drawingShapeCount || 0;

    // 加载预览图
    useEffect(() => {
        if (!drawingId) return;

        const loadPreview = async () => {
            setLoading(true);
            try {
                // 先尝试从 LocalForage 获取预览图
                const { getPreviewFromStorage } = await import("../utils/canvas-drawing-preview");
                const cachedPreview = await getPreviewFromStorage(projectId, drawingId);

                if (cachedPreview) {
                    setPreviewUrl(cachedPreview);
                } else {
                    // 如果没有缓存，尝试从文档获取
                    const doc = await getDrawingDocument(projectId, drawingId);
                    if (doc?.previewUrl) {
                        setPreviewUrl(doc.previewUrl);
                    }
                }
            } catch (error) {
                console.error("Failed to load drawing preview:", error);
            } finally {
                setLoading(false);
            }
        };

        loadPreview();
    }, [projectId, drawingId]);

    // 双击打开编辑器
    const handleDoubleClick = () => {
        if (drawingId) {
            setEditorOpen(true);
            onEdit?.();
        }
    };

    return (
        <>
            <div
                className={`relative w-full h-full rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
                    selected ? "border-blue-500 shadow-lg" : "border-gray-300"
                }`}
                onDoubleClick={handleDoubleClick}
            >
                {/* 预览区域 */}
                <div className="absolute inset-0 bg-white flex items-center justify-center">
                    {loading ? (
                        <div className="text-gray-400">
                            <FileImage className="w-12 h-12 mb-2 mx-auto" />
                            <div className="text-sm">加载中...</div>
                        </div>
                    ) : previewUrl ? (
                        <img
                            src={previewUrl}
                            alt={node.title}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="text-gray-400 text-center p-4">
                            <FileImage className="w-12 h-12 mb-2 mx-auto" />
                            <div className="text-sm">
                                {engine === "excalidraw" ? "Excalidraw" : "Tldraw"} 绘图
                            </div>
                            {shapeCount > 0 && (
                                <div className="text-xs mt-1">{shapeCount} 个图形</div>
                            )}
                            <div className="text-xs mt-2 text-blue-500">双击编辑</div>
                        </div>
                    )}
                </div>

                {/* 标题栏 */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <div className="flex items-center justify-between text-white text-sm">
                        <span className="font-medium truncate">{node.title}</span>
                        <Button
                            type="text"
                            size="small"
                            icon={<Edit className="w-4 h-4 text-white" />}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (drawingId) setEditorOpen(true);
                            }}
                        />
                    </div>
                </div>

                {/* 引擎标识 */}
                <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    {engine === "excalidraw" ? "Excalidraw" : "Tldraw"}
                </div>
            </div>

            {/* 编辑器模态框 */}
            {drawingId && (
                <CanvasDrawingEditorModal
                    open={editorOpen}
                    onClose={() => setEditorOpen(false)}
                    projectId={projectId}
                    drawingId={drawingId}
                    initialEngine={engine}
                />
            )}
        </>
    );
}
