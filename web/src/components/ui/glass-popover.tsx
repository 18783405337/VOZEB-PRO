import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type GlassPopoverProps = HTMLAttributes<HTMLDivElement> & {
    role?: "menu" | "listbox" | "dialog" | "tooltip";
};

export function GlassPopover({ className, role = "menu", ...props }: GlassPopoverProps) {
    return <div data-glass-popover role={role} className={cn("glass-surface-strong rounded-[var(--glass-radius)]", className)} {...props} />;
}
