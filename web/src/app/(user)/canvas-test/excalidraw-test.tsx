"use client";

import { useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

export function ExcalidrawEditor() {
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const [status, setStatus] = useState<string>("初始化中...");

    useEffect(() => {
        if (excalidrawAPI) {
            setStatus("✅ Excalidraw 加载成功");
            console.log("Excalidraw API:", excalidrawAPI);
        }
    }, [excalidrawAPI]);

    return (
        <div className="w-full">
            <div className="bg-green-50 p-3 text-sm border-b">
                <strong>状态:</strong> {status}
            </div>
            <div style={{ height: "600px" }}>
                <Excalidraw
                    excalidrawAPI={(api) => setExcalidrawAPI(api)}
                    initialData={{
                        elements: [],
                        appState: {
                            viewBackgroundColor: "#ffffff",
                        },
                    }}
                />
            </div>
        </div>
    );
}
