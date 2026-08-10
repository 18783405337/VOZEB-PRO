import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function GlassPopover({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div role="menu" data-glass-popover className={cn("glass-surface-strong rounded-xl", className)} {...props} />;
}