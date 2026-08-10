import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type GlassDialogProps = HTMLAttributes<HTMLDivElement> & {
    labelledBy?: string;
    describedBy?: string;
};

export function GlassDialog({ className, labelledBy, describedBy, role = "dialog", ...props }: GlassDialogProps) {
    return <div data-glass-dialog role={role} aria-modal={role === "dialog" ? true : undefined} aria-labelledby={labelledBy} aria-describedby={describedBy} className={cn("glass-surface-strong rounded-2xl", className)} {...props} />;
}

export function GlassDialogBackdrop({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div data-glass-dialog-backdrop className={cn("glass-overlay-backdrop", className)} {...props} />;
}
