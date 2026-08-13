"use client";

import { Button } from "antd";
import { LogOut, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PublicUser } from "@/lib/auth/store";
import { resetClientSessionState } from "@/lib/client-session-reset";

export function TenantAdminAccessDenied({ user }: { user: PublicUser }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function switchAccount() {
        setLoading(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            await resetClientSessionState();
            router.replace("/login?next=/tenant-admin");
            router.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-dvh items-center justify-center bg-white px-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
            <section className="w-full max-w-md border border-zinc-200 p-6 dark:border-zinc-800">
                <ShieldX className="size-8 text-red-500" />
                <h1 className="mt-4 text-xl font-semibold">当前登录账号不属于此租户</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    当前账号 <strong className="text-zinc-800 dark:text-zinc-200">{user.displayName || user.username}</strong> 没有该租户的有效成员权限。租户域名与平台域名使用独立登录会话，请切换为该租户的所有者或成员账号。
                </p>
                <Button className="mt-5" type="primary" icon={<LogOut className="size-4" />} loading={loading} onClick={() => void switchAccount()}>
                    退出并切换账号
                </Button>
            </section>
        </main>
    );
}
