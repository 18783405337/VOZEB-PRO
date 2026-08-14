"use client";

import { useEffect, useState } from "react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

export function TldrawEditor() {
    const [status, setStatus] = useState<string>("初始化中...");

    useEffect(() => {
        setStatus("✅ Tldraw 加载成功");
        console.log("Tldraw loaded");
    }, []);

    return (
        <div className="w-full">
            <div className="bg-green-50 p-3 text-sm border-b">
                <strong>状态:</strong> {status}
            </div>
            <div style={{ height: "600px" }}>
                <Tldraw />
            </div>
        </div>
    );
}
