import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function GlassDialog({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div role="dialog" data-glass-dialog className={cn("glass-surface-strong rounded-2xl", className)} {...props} />;
}