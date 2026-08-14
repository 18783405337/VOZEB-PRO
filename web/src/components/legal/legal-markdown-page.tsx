import Link from "next/link";
import { ArrowLeft, Scale, ShieldCheck } from "lucide-react";

import { AgentMarkdown } from "@/components/agent/agent-markdown";

export function LegalMarkdownPage({ kind, content }: { kind: "terms" | "privacy"; content: string }) {
    const privacy = kind === "privacy";
    const title = privacy ? "隐私协议" : "服务条款";
    const Icon = privacy ? ShieldCheck : Scale;
    return (
        <main className="app-scroll-page bg-stone-50 text-stone-800 dark:bg-stone-950 dark:text-stone-200">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-5 py-8 sm:px-8 sm:py-10">
                <Link href="/create" className="inline-flex w-fit items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-cyan-300 hover:text-cyan-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200">
                    <ArrowLeft className="size-4" />
                    返回操作台
                </Link>
                <section className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
                    <header className="flex items-center gap-3 border-b border-stone-200 px-5 py-5 dark:border-stone-800 sm:px-7">
                        <span className="grid size-10 place-items-center rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200"><Icon className="size-5" /></span>
                        <h1 className="text-2xl font-semibold text-stone-950 dark:text-white">{title}</h1>
                    </header>
                    <AgentMarkdown className="px-5 py-6 text-sm leading-7 text-stone-700 dark:text-stone-300 sm:px-7">{content}</AgentMarkdown>
                </section>
            </div>
        </main>
    );
}
