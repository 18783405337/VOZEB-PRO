import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
    tone?: "default" | "strong" | "muted";
    radius?: "sm" | "md" | "lg";
};

export function GlassPanel({ className, tone = "default", radius = "md", ...props }: GlassPanelProps) {
    return <div data-glass-panel className={cn(tone === "strong" ? "glass-surface-strong" : tone === "muted" ? "glass-surface-muted" : "glass-surface", radius === "sm" ? "rounded-lg" : radius === "lg" ? "rounded-2xl" : "rounded-xl", className)} {...props} />;
}