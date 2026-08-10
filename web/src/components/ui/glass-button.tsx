import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "glass" | "solid" | "quiet" | "danger";
    size?: "sm" | "md" | "lg";
};

export function GlassButton({ className, variant = "glass", size = "md", ...props }: GlassButtonProps) {
    return (
        <button
            data-glass-button
            className={cn(
                "glass-focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
                size === "sm" ? "h-8 px-2.5 text-xs" : size === "lg" ? "h-11 px-4 text-sm" : "h-9 px-3 text-sm",
                variant === "solid"
                    ? "border-transparent bg-[rgb(var(--glass-accent))] text-white shadow-sm hover:bg-[rgb(var(--glass-accent)/0.88)]"
                    : variant === "danger"
                      ? "border-red-500/20 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300"
                      : variant === "quiet"
                        ? "border-transparent bg-transparent text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
                        : "glass-surface text-foreground hover:bg-black/5 dark:hover:bg-white/10",
                className,
            )}
            {...props}
        />
    );
}