import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ReceiptText } from "lucide-react";

import { TenantAdminShell } from "@/components/tenant-admin/tenant-admin-shell";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { getCurrentUser } from "@/lib/auth/session";
import { TenantContextError } from "@/lib/server/tenant/tenant-context";
import { getTenantPageContext } from "@/lib/server/tenant/tenant-page-context";

export default async function TenantAdminPage() {
    const currentUser = await getCurrentUser();
    if (!currentUser) redirect("/login?next=/tenant-admin");

    let context;
    try {
        context = await getTenantPageContext("/tenant-admin");
    } catch (error) {
        if (error instanceof TenantContextError) redirect("/");
        throw error;
    }
    if (!context.member) redirect("/");

    return (
        <main className="min-h-dvh bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="border-b border-zinc-200 dark:border-zinc-800">
                <div className="mx-auto flex h-14 w-full max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                    <Link href="/" className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                        <ArrowLeft className="size-4" />
                        返回工作台
                    </Link>
                    <div className="flex items-center gap-3">
                        <Link href="/tenant-admin/billing" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                            <ReceiptText className="size-4" />
                            账单后台
                        </Link>
                        <UserStatusActions initialUser={currentUser} />
                    </div>
                </div>
            </div>
            <TenantAdminShell initialContext={{ ...context, member: context.member }} />
        </main>
    );
}
