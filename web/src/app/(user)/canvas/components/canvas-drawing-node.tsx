"use client";

import React from "react";

/**
 * Canvas Drawing Node Component
 *
 * 绘图节点主组件 - 支持 Excalidraw 和 Tldraw 双引擎
 */

export interface CanvasDrawingNodeProps {
    nodeId: string;
    projectId: string;
    drawingId?: string;
    engine?: "excalidraw" | "tldraw";
    onEngineChange?: (engine: "excalidraw" | "tldraw") => void;
    readOnly?: boolean;
}

export function CanvasDrawingNode({
    nodeId,
    projectId,
    drawingId,
    engine = "tldraw",
    onEngineChange,
    readOnly = false,
}: CanvasDrawingNodeProps) {
    return (
        <div className="canvas-drawing-node">
            <div className="p-4 text-center text-muted-foreground">
                <p>Drawing Node Component</p>
                <p className="text-sm">Engine: {engine}</p>
                <p className="text-xs">Project: {projectId}</p>
                <p className="text-xs">Node: {nodeId}</p>
                {drawingId && <p className="text-xs">Drawing: {drawingId}</p>}
            </div>
        </div>
    );
}
