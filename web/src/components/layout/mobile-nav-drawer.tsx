"use client";

import { Drawer } from "antd";
import { ChevronDown, CircleHelp, FileText, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SiteLogo } from "@/components/layout/site-logo";
import { navigationGroups, navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { cn } from "@/lib/utils";
import { usePublicSessionStore } from "@/stores/use-public-session-store";

type MobileNavDrawerProps = {
    open: boolean;
    activeToolSlug?: NavigationToolSlug;
    onClose: () => void;
};

export function MobileNavDrawer({ open, activeToolSlug, onClose }: MobileNavDrawerProps) {
    const pathname = usePathname();
    const router = useRouter();
    const previousPathnameRef = useRef(pathname);
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "VOZEB PRO", logoUrl: "/logo.svg", termsUrl: "/terms", privacyUrl: "/privacy" };
    const helpActive = pathname.startsWith("/help");
    const legalActive = pathname.startsWith("/terms") || pathname.startsWith("/privacy");
    const [legalOpen, setLegalOpen] = useState(legalActive);

    useEffect(() => {
        if (previousPathnameRef.current === pathname) return;
        previousPathnameRef.current = pathname;
        onClose();
    }, [onClose, pathname]);

    return (
        <Drawer
            title={
                <Link href="/create" onClick={onClose} className="inline-flex min-w-0 items-center gap-2.5 text-base font-semibold leading-none text-[#20242a] dark:text-[#f3f5f7]">
                    <SiteLogo logoUrl={site.logoUrl} className="size-8" />
                    <span className="truncate">{site.title || "VOZEB PRO"}</span>
                </Link>
            }
            placement="left"
            size={288}
            open={open}
            onClose={onClose}
            className="glass-mobile-nav-drawer lg:hidden"
            rootClassName="glass-mobile-nav-root"
            width="min(288px, calc(100vw - 24px))"
            styles={{ mask: { backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", background: "rgba(2, 6, 23, 0.34)" }, content: { background: "var(--glass-bg-strong)", backdropFilter: "blur(22px) saturate(1.18)", WebkitBackdropFilter: "blur(22px) saturate(1.18)", borderRight: "1px solid var(--glass-border)" }, header: { borderBottomColor: "var(--glass-border)", minHeight: 60, padding: "12px 16px", background: "transparent" }, body: { padding: "12px 14px 18px", background: "transparent" } }}
        >
            {navigationGroups.map((group, groupIndex) => (
                <div key={group.id} className={cn(groupIndex > 0 && "mt-5")}>
                    <div className="mb-1 px-3 text-[11px] font-medium text-[#9aa2ad] dark:text-[#737d89]">{group.label}</div>
                    <div className="space-y-1">
                        {navigationTools
                            .filter((tool) => tool.group === group.id)
                            .map((tool) => {
                                const Icon = tool.icon;
                                const active = tool.slug === activeToolSlug;
                                return (
                                    <Link
                                        key={tool.slug}
                                        href={`/${tool.slug}`}
                                        prefetch
                                        onMouseEnter={() => router.prefetch(`/${tool.slug}`)}
                                        onFocus={() => router.prefetch(`/${tool.slug}`)}
                                        onClick={onClose}
                                        className={cn(
                                            "glass-focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                                            active
                                                ? "glass-surface-muted font-medium text-[#1d2127] dark:text-[#f3f5f7]"
                                                : "text-[#697381] hover:bg-[var(--glass-bg-hover)] hover:text-[#20242a] dark:text-[#9aa3af] dark:hover:bg-white/8 dark:hover:text-[#f3f5f7]",
                                        )}
                                        aria-current={active ? "page" : undefined}
                                    >
                                        <Icon className="size-[18px] shrink-0" />
                                        <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                                        <span className={cn("size-1.5 rounded-full", active ? "bg-current" : "bg-transparent")} />
                                    </Link>
                                );
                            })}
                    </div>
                </div>
            ))}
            <div className="mt-5 border-t border-[var(--glass-border)] pt-4">
                <button
                    type="button"
                    className={cn(
                        "glass-focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                        legalActive ? "glass-surface-muted font-medium text-[#1d2127] dark:text-[#f3f5f7]" : "text-[#697381] hover:bg-[var(--glass-bg-hover)] hover:text-[#20242a] dark:text-[#9aa3af] dark:hover:bg-white/8 dark:hover:text-[#f3f5f7]",
                    )}
                    aria-expanded={legalOpen}
                    onClick={() => setLegalOpen((value) => !value)}
                >
                    <Scale className="size-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 text-left">协议与政策</span>
                    <ChevronDown className={cn("size-4 transition-transform", legalOpen && "rotate-180")} />
                </button>
                {legalOpen ? (
                    <div className="ml-4 space-y-1 border-l border-[var(--glass-border)] pl-3">
                        <Link href={site.termsUrl || "/terms"} onClick={onClose} className="glass-focus-ring flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#697381] hover:bg-[var(--glass-bg-hover)] dark:text-[#9aa3af] dark:hover:bg-white/8">
                            <FileText className="size-4" />
                            <span>服务条款</span>
                        </Link>
                        <Link href={site.privacyUrl || "/privacy"} onClick={onClose} className="glass-focus-ring flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#697381] hover:bg-[var(--glass-bg-hover)] dark:text-[#9aa3af] dark:hover:bg-white/8">
                            <ShieldCheck className="size-4" />
                            <span>隐私协议</span>
                        </Link>
                    </div>
                ) : null}
                <Link
                    href="/help"
                    prefetch
                    onMouseEnter={() => router.prefetch("/help")}
                    onFocus={() => router.prefetch("/help")}
                    onClick={onClose}
                    className={cn(
                        "glass-focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                        helpActive ? "glass-surface-muted font-medium text-[#1d2127] dark:text-[#f3f5f7]" : "text-[#697381] hover:bg-[var(--glass-bg-hover)] hover:text-[#20242a] dark:text-[#9aa3af] dark:hover:bg-white/8 dark:hover:text-[#f3f5f7]",
                    )}
                    aria-current={helpActive ? "page" : undefined}
                >
                    <CircleHelp className="size-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate">帮助中心</span>
                    <span className={cn("size-1.5 rounded-full", helpActive ? "bg-current" : "bg-transparent")} />
                </Link>
            </div>
        </Drawer>
    );
}
