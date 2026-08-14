"use client";

import { ChevronDown, CircleHelp, FileText, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { SiteLogo } from "@/components/layout/site-logo";
import { navigationGroups, navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { cn } from "@/lib/utils";
import { usePublicSessionStore } from "@/stores/use-public-session-store";

export function AppSidebar({ activeToolSlug, expanded, onRequestExpand }: { activeToolSlug?: NavigationToolSlug; expanded: boolean; onRequestExpand: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "VOZEB PRO", logoUrl: "/logo.svg", termsUrl: "/terms", privacyUrl: "/privacy" };
    const helpActive = pathname.startsWith("/help");
    const legalActive = pathname.startsWith("/terms") || pathname.startsWith("/privacy");
    const [legalOpen, setLegalOpen] = useState(legalActive);

    return (
        <aside data-glass-sidebar className={cn("glass-surface-strong hidden h-full shrink-0 flex-col rounded-none text-[#20242a] transition-[width] duration-200 lg:flex dark:text-[#f3f5f7]", expanded ? "w-56" : "w-[72px]")}>
            <Link href="/create" className={cn("flex h-[60px] shrink-0 items-center border-b border-[var(--glass-border)] px-3", expanded ? "justify-start px-5" : "justify-center")} aria-label={site.title || "VOZEB PRO"}>
                <SiteLogo logoUrl={site.logoUrl} className="size-8" />
                {expanded ? <span className="ml-3 min-w-0 truncate text-sm font-semibold">{site.title || "VOZEB PRO"}</span> : null}
            </Link>

            <nav className={cn("hide-scrollbar min-h-0 flex-1 overflow-y-auto py-4", expanded ? "px-3" : "px-2")} aria-label="工作空间导航">
                {navigationGroups.map((group, groupIndex) => {
                    const tools = navigationTools.filter((tool) => tool.group === group.id);
                    return (
                        <div key={group.id} className={cn(groupIndex > 0 && "mt-5")}>
                            {expanded ? <div className="mb-1 px-2 text-[11px] font-medium text-[#9aa2ad] dark:text-[#737d89]">{group.label}</div> : null}
                            <div className="space-y-1">
                                {tools.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.slug === activeToolSlug;
                                    const primary = "primary" in tool && tool.primary;
                                    return (
                                        <Link
                                            key={tool.slug}
                                            href={`/${tool.slug}`}
                                            prefetch
                                            title={tool.label}
                                            onMouseEnter={() => router.prefetch(`/${tool.slug}`)}
                                            onFocus={() => router.prefetch(`/${tool.slug}`)}
                                            className={cn(
                                                "glass-focus-ring group relative flex h-10 items-center rounded-lg px-2 text-sm font-medium transition",
                                                expanded ? "justify-start gap-3 px-3" : "justify-center",
                                                active
                                                    ? "glass-surface-muted text-[#1d2127] dark:text-[#f3f5f7]"
                                                    : primary
                                                      ? "text-[#343b44] hover:bg-[var(--glass-bg-hover)] dark:text-[#d4d9df] dark:hover:bg-white/8"
                                                      : "text-[#697381] hover:bg-[var(--glass-bg-hover)] hover:text-[#20242a] dark:text-[#8f99a6] dark:hover:bg-white/8 dark:hover:text-[#f3f5f7]",
                                            )}
                                            aria-current={active ? "page" : undefined}
                                        >
                                            <Icon className="size-[18px] shrink-0" />
                                            {expanded ? <span className="min-w-0 truncate">{tool.label}</span> : null}
                                            {active ? <span className="absolute right-1 h-4 w-0.5 rounded-full bg-[rgb(var(--glass-accent))]" /> : null}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            <div className={cn("shrink-0 border-t border-[var(--glass-border)]", expanded ? "p-3" : "p-2")}>
                <button
                    type="button"
                    title="协议与政策"
                    className={cn(
                        "glass-focus-ring relative flex h-10 w-full items-center rounded-lg px-2 text-sm font-medium text-[#697381] transition hover:bg-[var(--glass-bg-hover)] hover:text-[#20242a] dark:text-[#8f99a6] dark:hover:bg-white/8 dark:hover:text-[#f3f5f7]",
                        expanded ? "justify-start gap-3 px-3" : "justify-center",
                        legalActive && "glass-surface-muted text-[#1d2127] dark:text-[#f3f5f7]",
                    )}
                    aria-expanded={expanded && legalOpen}
                    onClick={() => {
                        if (!expanded) onRequestExpand();
                        setLegalOpen((value) => !value);
                    }}
                >
                    <Scale className="size-[18px] shrink-0" />
                    {expanded ? <span className="min-w-0 flex-1 text-left">协议与政策</span> : null}
                    {expanded ? <ChevronDown className={cn("size-4 transition-transform", legalOpen && "rotate-180")} /> : null}
                </button>
                {expanded && legalOpen ? (
                    <div className="mb-1 ml-3 mt-1 space-y-1 border-l border-[var(--glass-border)] pl-3">
                        <Link href={site.termsUrl || "/terms"} className="glass-focus-ring flex h-9 items-center gap-2 rounded-lg px-2 text-xs text-[#697381] transition hover:bg-[var(--glass-bg-hover)] hover:text-[#20242a] dark:text-[#8f99a6] dark:hover:bg-white/8 dark:hover:text-[#f3f5f7]">
                            <FileText className="size-4 shrink-0" />
                            <span>服务条款</span>
                        </Link>
                        <Link href={site.privacyUrl || "/privacy"} className="glass-focus-ring flex h-9 items-center gap-2 rounded-lg px-2 text-xs text-[#697381] transition hover:bg-[var(--glass-bg-hover)] hover:text-[#20242a] dark:text-[#8f99a6] dark:hover:bg-white/8 dark:hover:text-[#f3f5f7]">
                            <ShieldCheck className="size-4 shrink-0" />
                            <span>隐私协议</span>
                        </Link>
                    </div>
                ) : null}
                <Link
                    href="/help"
                    prefetch
                    title="帮助中心"
                    onMouseEnter={() => router.prefetch("/help")}
                    onFocus={() => router.prefetch("/help")}
                    className={cn(
                        "glass-focus-ring relative flex h-10 items-center rounded-lg px-2 text-sm font-medium text-[#697381] transition hover:bg-[var(--glass-bg-hover)] hover:text-[#20242a] dark:text-[#8f99a6] dark:hover:bg-white/8 dark:hover:text-[#f3f5f7]",
                        expanded ? "justify-start gap-3 px-3" : "justify-center",
                        helpActive && "glass-surface-muted text-[#1d2127] dark:text-[#f3f5f7]",
                    )}
                    aria-current={helpActive ? "page" : undefined}
                >
                    <CircleHelp className="size-[18px] shrink-0" />
                    {expanded ? <span>帮助中心</span> : null}
                    {helpActive ? <span className="absolute right-1 h-4 w-0.5 rounded-full bg-[rgb(var(--glass-accent))]" /> : null}
                </Link>
            </div>
        </aside>
    );
}
