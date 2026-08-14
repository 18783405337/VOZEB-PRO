"use client";

import { useEffect, useState, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

type ExcalidrawEditorProps = {
    initialData?: unknown;
    onChange?: (data: unknown) => void;
    readOnly?: boolean;
};

export function ExcalidrawEditor({ initialData, onChange, readOnly = false }: ExcalidrawEditorProps) {
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const changeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!excalidrawAPI || !onChange) return;

        const handleChange = () => {
            // 防抖处理
            if (changeTimeoutRef.current) {
                clearTimeout(changeTimeoutRef.current);
            }

            changeTimeoutRef.current = setTimeout(() => {
                const elements = excalidrawAPI.getSceneElements();
                const appState = excalidrawAPI.getAppState();
                const files = excalidrawAPI.getFiles();

                const data = {
                    elements,
                    appState: {
                        viewBackgroundColor: appState.viewBackgroundColor,
                        currentItemFontFamily: appState.currentItemFontFamily,
                        currentItemFontSize: appState.currentItemFontSize,
                        currentItemTextAlign: appState.currentItemTextAlign,
                    },
                    files,
                };

                onChange(data);
            }, 500); // 500ms 防抖
        };

        // 监听变化
        excalidrawAPI.onChange(handleChange);

        return () => {
            if (changeTimeoutRef.current) {
                clearTimeout(changeTimeoutRef.current);
            }
        };
    }, [excalidrawAPI, onChange]);

    return (
        <div className="w-full h-full">
            <Excalidraw
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                initialData={initialData as any}
                viewModeEnabled={readOnly}
                zenModeEnabled={false}
                gridModeEnabled={false}
                theme="light"
            />
        </div>
    );
}
