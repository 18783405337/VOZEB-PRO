import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
    tone?: "default" | "strong" | "muted";
    radius?: "sm" | "md" | "lg";
};

const toneClasses = {
    default: "glass-surface",
    strong: "glass-surface-strong",
    muted: "glass-surface-muted",
} as const;

const radiusClasses = {
    sm: "rounded-lg",
    md: "rounded-[var(--glass-radius)]",
    lg: "rounded-2xl",
} as const;

export function GlassPanel({ tone = "default", radius = "md", className, ...props }: GlassPanelProps) {
    return <div data-glass-panel className={cn(toneClasses[tone], radiusClasses[radius], className)} {...props} />;
}
