"use client";

import { useState } from "react";
import { Button, Radio, Space } from "antd";
import dynamic from "next/dynamic";

// 动态导入绘图编辑器，避免 SSR 问题
const ExcalidrawEditor = dynamic(
    () => import("./excalidraw-test").then((mod) => mod.ExcalidrawEditor),
    { ssr: false, loading: () => <div className="p-4">加载 Excalidraw 编辑器...</div> }
);

const TldrawEditor = dynamic(
    () => import("./tldraw-test").then((mod) => mod.TldrawEditor),
    { ssr: false, loading: () => <div className="p-4">加载 Tldraw 编辑器...</div> }
);

type EditorType = "excalidraw" | "tldraw" | null;

export default function CanvasTestPage() {
    const [editorType, setEditorType] = useState<EditorType>(null);

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">画布功能技术验证</h1>

                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h2 className="text-lg font-semibold mb-2">测试目标</h2>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>验证 Excalidraw 在 Next.js 19 + React 19 环境下的兼容性</li>
                        <li>验证 Tldraw 在 Next.js 19 + React 19 环境下的兼容性</li>
                        <li>测试动态导入和 SSR 禁用配置</li>
                        <li>检查打包体积和加载性能</li>
                    </ul>
                </div>

                <Space className="mb-6">
                    <Radio.Group value={editorType} onChange={(e) => setEditorType(e.target.value)}>
                        <Radio.Button value="excalidraw">Excalidraw 编辑器</Radio.Button>
                        <Radio.Button value="tldraw">Tldraw 编辑器</Radio.Button>
                    </Radio.Group>
                    {editorType && (
                        <Button onClick={() => setEditorType(null)}>关闭编辑器</Button>
                    )}
                </Space>

                {editorType === "excalidraw" && (
                    <div className="border rounded-lg overflow-hidden">
                        <ExcalidrawEditor />
                    </div>
                )}

                {editorType === "tldraw" && (
                    <div className="border rounded-lg overflow-hidden">
                        <TldrawEditor />
                    </div>
                )}

                {!editorType && (
                    <div className="text-center text-gray-500 py-12">
                        选择一个编辑器开始测试
                    </div>
                )}
            </div>
        </div>
    );
}
