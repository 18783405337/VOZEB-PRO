import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { UserStatusActions } from "@/components/layout/user-status-actions";
import { getCurrentUser } from "@/lib/auth/session";
import { TenantContextError } from "@/lib/server/tenant/tenant-context";
import { getTenantPageContext } from "@/lib/server/tenant/tenant-page-context";
import { isSaasBillingEnabled } from "@/lib/server/tenant/saas-feature";

import { TenantBillingClient } from "./components/tenant-billing-client";

export default async function TenantBillingPage() {
    const currentUser = await getCurrentUser();
    if (!currentUser) redirect("/login?next=/tenant-admin/billing");
    if (!isSaasBillingEnabled()) redirect("/tenant-admin");

    let context;
    try {
        context = await getTenantPageContext("/tenant-admin/billing");
    } catch (error) {
        if (error instanceof TenantContextError) redirect("/");
        throw error;
    }
    if (!context.member) redirect("/");

    const permissions = new Set(context.member.permissions);
    const isOwner = context.member.roleKey === "owner";
    if (!isOwner && !permissions.has("tenant.billing.read")) redirect("/tenant-admin");

    return (
        <main className="min-h-dvh bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="border-b border-zinc-200 dark:border-zinc-800">
                <div className="mx-auto flex h-14 w-full max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                    <Link href="/tenant-admin" className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                        <ArrowLeft className="size-4" />
                        返回租户管理
                    </Link>
                    <UserStatusActions initialUser={currentUser} />
                </div>
            </div>
            <TenantBillingClient tenantName={context.tenant.name} tenantSlug={context.tenant.slug} />
        </main>
    );
}
