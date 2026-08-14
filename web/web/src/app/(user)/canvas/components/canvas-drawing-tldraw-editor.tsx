"use client";

import { useEffect, useRef, useCallback } from "react";
import { Tldraw, useEditor } from "tldraw";
import "tldraw/tldraw.css";

type TldrawEditorProps = {
    initialData?: unknown;
    onChange?: (data: unknown) => void;
    readOnly?: boolean;
};

// 内部组件用于访问编辑器实例
function TldrawEditorInner({ onChange, readOnly }: { onChange?: (data: unknown) => void; readOnly?: boolean }) {
    const editor = useEditor();
    const changeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!editor || !onChange) return;

        const handleChange = () => {
            // 防抖处理
            if (changeTimeoutRef.current) {
                clearTimeout(changeTimeoutRef.current);
            }

            changeTimeoutRef.current = setTimeout(() => {
                try {
                    const snapshot = editor.store.getSnapshot();
                    onChange(snapshot);
                } catch (error) {
                    console.error("Failed to get Tldraw snapshot:", error);
                }
            }, 500); // 500ms 防抖
        };

        // 监听 store 变化
        const dispose = editor.store.listen(handleChange);

        return () => {
            dispose();
            if (changeTimeoutRef.current) {
                clearTimeout(changeTimeoutRef.current);
            }
        };
    }, [editor, onChange]);

    // 设置只读模式
    useEffect(() => {
        if (!editor) return;
        editor.updateInstanceState({ isReadonly: readOnly });
    }, [editor, readOnly]);

    return null;
}

export function TldrawEditor({ initialData, onChange, readOnly = false }: TldrawEditorProps) {
    const handleMount = useCallback((editor: any) => {
        if (initialData) {
            try {
                editor.store.loadSnapshot(initialData);
            } catch (error) {
                console.error("Failed to load Tldraw snapshot:", error);
            }
        }
    }, [initialData]);

    return (
        <div className="w-full h-full">
            <Tldraw
                onMount={handleMount}
                autoFocus
            >
                <TldrawEditorInner onChange={onChange} readOnly={readOnly} />
            </Tldraw>
        </div>
    );
}
