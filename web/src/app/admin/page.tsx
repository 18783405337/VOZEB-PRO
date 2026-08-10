import Link from "next/link";
import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";

import { AuthUserHydrator } from "@/components/auth/auth-user-hydrator";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { parseAdminSection } from "@/components/admin/admin-sections";
import { AdminReturnButton } from "@/components/admin/admin-return-button";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { getAuthSettings, getPublicUserSummary } from "@/lib/auth/store";
import { getAdminSetupSummary } from "@/lib/server/admin-setup-status";
import { serializeAdminSettings } from "@/lib/server/admin-channel-config";
import { getAuthenticatedPageAccess } from "@/lib/server/page-access";

type AdminPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
    const params = searchParams ? await searchParams : {};
    const initialSection = parseAdminSection(params.section);
    const access = await getAuthenticatedPageAccess();
    if (!access.user) {
        if (!access.install.database.healthy || access.install.firstAdminRequired) redirect("/install");
        redirect("/login?next=/admin");
    }
    const currentUser = access.user;
    if (currentUser.role !== "admin") redirect("/");

    const [settings, userSummary] = await Promise.all([getAuthSettings(), getPublicUserSummary()]);
    const setup = await getAdminSetupSummary({ settings, userSummary });

    return (
        <AuthUserHydrator
            user={{
                id: currentUser.id,
                accountId: currentUser.accountId,
                username: currentUser.username,
                email: currentUser.email,
                displayName: currentUser.displayName,
                bio: currentUser.bio,
                role: currentUser.role,
                status: currentUser.status,
                planId: currentUser.planId,
                planName: currentUser.planName,
                hasActivePlan: currentUser.hasActivePlan,
                pointsBalance: currentUser.pointsBalance,
            }}
        >
            <main data-glass-admin className="admin-console-page app-scroll-page relative bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
                <AdminDashboard
                    initialUsers={[]}
                    initialUserSummary={userSummary}
                    initialSettings={serializeAdminSettings(settings)}
                    initialPromptCount={0}
                    currentUser={currentUser}
                    initialSection={initialSection}
                    setupSummary={setup}
                    headerActions={
                        <>
                            <Link href="/admin/billing" className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
                                <ReceiptText className="size-4" />
                                财务中心
                            </Link>
                            <AdminReturnButton />
                            <UserStatusActions initialUser={currentUser} />
                        </>
                    }
                />
            </main>
        </AuthUserHydrator>
    );
}
