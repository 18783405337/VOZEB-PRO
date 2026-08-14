"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { TiptapEditor } from "./canvas-script-tiptap-editor";
import { saveScriptToLocal, loadScriptFromLocal } from "../utils/canvas-script-storage";
import { extractPlainText, calculateTextStats, tiptapToMarkdown } from "../utils/canvas-script-markdown";
import { FileText, Save, Clock, AlertCircle } from "lucide-react";

type CanvasScriptNodeProps = {
    node: any;
    projectId: string;
};

/**
 * Script 节点主组件
 */
export function CanvasScriptNode({ node, projectId }: CanvasScriptNodeProps) {
    const scriptId = node.metadata?.scriptId;
    const [content, setContent] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState({ characterCount: 0, wordCount: 0 });
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const AUTO_SAVE_DELAY = 2000; // 2秒后自动保存

    // 加载脚本内容
    useEffect(() => {
        async function loadScript() {
            if (!scriptId) {
                setError("脚本 ID 未配置");
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                // 首先尝试从本地加载
                const localData = await loadScriptFromLocal({ projectId, scriptId });
                if (localData?.content) {
                    setContent(localData.content);
                    setStats({
                        characterCount: localData.characterCount || 0,
                        wordCount: localData.wordCount || 0,
                    });
                    setIsLoading(false);
                    return;
                }

                // 从服务器加载
                const response = await fetch(`/api/canvas/${projectId}/scripts/${scriptId}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.code === 0 && result.data?.document) {
                        const doc = result.data.document;
                        setContent(doc.content);
                        setStats({
                            characterCount: doc.characterCount || 0,
                            wordCount: doc.wordCount || 0,
                        });

                        // 保存到本地缓存
                        await saveScriptToLocal({ projectId, scriptId }, {
                            content: doc.content,
                            markdown: doc.markdown,
                            plainText: doc.plainText,
                            characterCount: doc.characterCount,
                            wordCount: doc.wordCount,
                            revision: doc.revision,
                            updatedAt: doc.updatedAt,
                        });
                    }
                } else if (response.status === 404) {
                    // 文档不存在，创建新文档
                    const emptyContent = {
                        type: "doc",
                        content: [{ type: "paragraph", content: [] }],
                    };
                    setContent(emptyContent);
                } else {
                    throw new Error("加载脚本失败");
                }
            } catch (err) {
                console.error("Failed to load script:", err);
                setError(err instanceof Error ? err.message : "加载失败");
                // 使用空文档作为后备
                setContent({
                    type: "doc",
                    content: [{ type: "paragraph", content: [] }],
                });
            } finally {
                setIsLoading(false);
            }
        }

        loadScript();
    }, [projectId, scriptId]);

    // 保存脚本到服务器
    const saveToServer = useCallback(
        async (contentToSave: any) => {
            if (!scriptId) return;

            try {
                setIsSaving(true);
                setError(null);

                const plainText = extractPlainText(contentToSave);
                const textStats = calculateTextStats(plainText);
                const markdown = tiptapToMarkdown(contentToSave);

                // 检查文档是否存在
                const checkResponse = await fetch(
                    `/api/canvas/${projectId}/scripts/${scriptId}?includeContent=false`
                );

                let response;
                if (checkResponse.status === 404) {
                    // 创建新文档
                    response = await fetch(`/api/canvas/${projectId}/scripts`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            scriptId,
                            title: node.title || "Untitled Script",
                            content: contentToSave,
                            markdown,
                            plainText,
                            characterCount: textStats.characterCount,
                            wordCount: textStats.wordCount,
                        }),
                    });
                } else {
                    // 更新现有文档
                    response = await fetch(`/api/canvas/${projectId}/scripts/${scriptId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: node.title || "Untitled Script",
                            content: contentToSave,
                            markdown,
                            plainText,
                            characterCount: textStats.characterCount,
                            wordCount: textStats.wordCount,
                            createVersion: false, // 自动保存不创建版本
                        }),
                    });
                }

                if (!response.ok) {
                    throw new Error("保存失败");
                }

                // 保存到本地缓存
                await saveScriptToLocal({ projectId, scriptId }, {
                    content: contentToSave,
                    markdown,
                    plainText,
                    characterCount: textStats.characterCount,
                    wordCount: textStats.wordCount,
                });

                setLastSaved(new Date());
            } catch (err) {
                console.error("Failed to save script:", err);
                setError("保存失败");
            } finally {
                setIsSaving(false);
            }
        },
        [projectId, scriptId, node.title]
    );

    // 处理内容变更
    const handleContentChange = useCallback(
        (newContent: any) => {
            setContent(newContent);

            // 取消之前的保存定时器
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            // 设置新的保存定时器
            saveTimerRef.current = setTimeout(() => {
                saveToServer(newContent);
            }, AUTO_SAVE_DELAY);
        },
        [saveToServer]
    );

    // 处理统计信息更新
    const handleStatsUpdate = useCallback(
        (newStats: { characterCount: number; wordCount: number }) => {
            setStats(newStats);
        },
        []
    );

    // 清理定时器
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    if (!scriptId) {
        return (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
                <div className="text-center">
                    <AlertCircle className="size-8 mx-auto mb-2" />
                    <div className="text-xs">脚本配置错误</div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <FileText className="size-8 mx-auto mb-2 text-gray-400 animate-pulse" />
                    <div className="text-xs text-gray-500">加载脚本编辑器...</div>
                </div>
            </div>
        );
    }

    if (error && !content) {
        return (
            <div className="flex h-full w-full items-center justify-center text-red-500">
                <div className="text-center">
                    <AlertCircle className="size-8 mx-auto mb-2" />
                    <div className="text-xs">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-white">
            {/* 状态栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>{stats.characterCount} 字符</span>
                    <span>{stats.wordCount} 单词</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    {isSaving && (
                        <div className="flex items-center gap-1">
                            <Save className="size-3 animate-pulse" />
                            <span>保存中...</span>
                        </div>
                    )}
                    {lastSaved && !isSaving && (
                        <div className="flex items-center gap-1">
                            <Clock className="size-3" />
                            <span>已保存 {lastSaved.toLocaleTimeString()}</span>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-1 text-red-500">
                            <AlertCircle className="size-3" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 编辑器 */}
            <div className="flex-1 overflow-hidden">
                {content && (
                    <TiptapEditor
                        content={content}
                        onChange={handleContentChange}
                        onUpdate={handleStatsUpdate}
                        placeholder="开始写作..."
                        readOnly={false}
                    />
                )}
            </div>
        </div>
    );
}
