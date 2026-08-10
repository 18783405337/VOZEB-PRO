import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "glass" | "solid" | "quiet" | "danger";
    size?: "sm" | "md" | "lg";
};

const variantClasses = {
    glass: "glass-surface-muted text-stone-700 hover:bg-[var(--glass-bg-hover)] hover:text-stone-950 dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white",
    solid: "border border-transparent bg-[rgb(var(--glass-accent))] text-white shadow-[0_12px_30px_rgb(var(--glass-accent)/0.24)] hover:bg-[rgb(var(--glass-accent)/0.9)] dark:bg-white dark:text-stone-950 dark:hover:bg-stone-100",
    quiet: "border border-transparent bg-transparent text-stone-600 hover:bg-stone-950/5 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/8 dark:hover:text-white",
    danger: "border border-[rgb(var(--glass-danger)/0.24)] bg-[rgb(var(--glass-danger)/0.08)] text-red-700 hover:bg-[rgb(var(--glass-danger)/0.14)] dark:text-red-200 dark:hover:bg-[rgb(var(--glass-danger)/0.18)]",
} as const;

const sizeClasses = {
    sm: "h-8 gap-1.5 rounded-lg px-2.5 text-xs",
    md: "h-9 gap-2 rounded-[var(--glass-radius)] px-3 text-sm",
    lg: "h-11 gap-2.5 rounded-2xl px-4 text-sm",
} as const;

export function GlassButton({ variant = "glass", size = "md", className, type = "button", ...props }: GlassButtonProps) {
    return <button data-glass-button type={type} className={cn("glass-interactive glass-focus-ring inline-flex shrink-0 items-center justify-center font-semibold", sizeClasses[size], variantClasses[variant], className)} {...props} />;
}
