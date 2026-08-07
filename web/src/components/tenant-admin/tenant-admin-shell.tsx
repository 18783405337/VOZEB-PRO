"use client";

import { useCallback, useEffect, useState } from "react";
import { Segmented, Tag } from "antd";
import { ShieldCheck, UsersRound } from "lucide-react";

import type { TenantContext } from "@/lib/server/tenant/tenant-context";
import type { TenantMemberRecord, TenantRoleRecord } from "@/lib/server/tenant/tenant-types";
import { listTenantMembers, listTenantRoles } from "@/services/api/tenant-admin";

import { TenantMembersSection } from "./tenant-members-section";
import { TenantRolesSection } from "./tenant-roles-section";

type TenantAdminContext = TenantContext & { member: TenantMemberRecord };
type TenantAdminView = "members" | "roles";

export function TenantAdminShell({ initialContext }: { initialContext: TenantAdminContext }) {
    const [view, setView] = useState<TenantAdminView>("members");
    const [members, setMembers] = useState<TenantMemberRecord[]>([]);
    const [roles, setRoles] = useState<TenantRoleRecord[]>([]);
    const [membersLoading, setMembersLoading] = useState(true);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [membersError, setMembersError] = useState<string>();
    const [rolesError, setRolesError] = useState<string>();
    const permissions = new Set(initialContext.member.permissions);
    const canManageMembers = permissions.has("tenant.members.manage");
    const canManageRoles = permissions.has("tenant.roles.manage");

    const refreshMembers = useCallback(async () => {
        setMembersLoading(true);
        setMembersError(undefined);
        try {
            setMembers(await listTenantMembers());
        } catch (error) {
            setMembersError(error instanceof Error ? error.message : "成员加载失败");
        } finally {
            setMembersLoading(false);
        }
    }, []);

    const refreshRoles = useCallback(async () => {
        setRolesLoading(true);
        setRolesError(undefined);
        try {
            setRoles(await listTenantRoles());
        } catch (error) {
            setRolesError(error instanceof Error ? error.message : "角色加载失败");
        } finally {
            setRolesLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshMembers();
        void refreshRoles();
    }, [refreshMembers, refreshRoles]);

    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-[1480px] flex-col px-4 py-5 sm:px-6 lg:px-8">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-semibold text-zinc-950 sm:text-2xl dark:text-zinc-100">{initialContext.tenant.name}</h1>
                        <Tag color={initialContext.tenant.status === "active" ? "green" : "default"}>{initialContext.tenant.status === "active" ? "运行中" : "已停用"}</Tag>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        租户标识 <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{initialContext.tenant.slug}</span>
                    </p>
                </div>
                <Segmented<TenantAdminView>
                    value={view}
                    onChange={setView}
                    options={[
                        { value: "members", label: <span className="inline-flex items-center gap-2"><UsersRound className="size-4" />成员</span> },
                        { value: "roles", label: <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4" />角色</span> },
                    ]}
                />
            </header>
            <div className="min-w-0 flex-1 py-6">
                {view === "members" ? <TenantMembersSection members={members} roles={roles} loading={membersLoading} canManage={canManageMembers} error={membersError} onRefresh={refreshMembers} /> : null}
                {view === "roles" ? <TenantRolesSection roles={roles} loading={rolesLoading} canManage={canManageRoles} error={rolesError} onRefresh={refreshRoles} /> : null}
            </div>
        </div>
    );
}
