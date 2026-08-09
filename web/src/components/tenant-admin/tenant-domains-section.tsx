"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, Segmented, Tag } from "antd";
import { Globe2, Plus, RefreshCw } from "lucide-react";

import type { TenantDomainRecord } from "@/lib/server/tenant/tenant-types";
import { createTenantDomain, deleteTenantDomain, listTenantDomains, updateTenantDomain } from "@/services/api/tenant-admin";
import { verifyTenantDomain } from "@/services/api/tenant-domain";

export function TenantDomainsSection({ canManage }: { canManage: boolean }) {
    const { message } = App.useApp();
    const [domains, setDomains] = useState<TenantDomainRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [hostname, setHostname] = useState("");
    const [kind, setKind] = useState<"custom" | "subdomain">("custom");
    const [submitting, setSubmitting] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try { setDomains(await listTenantDomains()); } catch (error) { message.error(error instanceof Error ? error.message : "域名加载失败"); } finally { setLoading(false); }
    }, [message]);
    useEffect(() => { void refresh(); }, [refresh]);

    async function add() {
        if (!hostname.trim()) return;
        setSubmitting(true);
        try { const domain = await createTenantDomain({ hostname, kind }); setDomains((current) => [...current, domain]); setHostname(""); message.success("域名已添加，请完成验证"); } catch (error) { message.error(error instanceof Error ? error.message : "域名添加失败"); } finally { setSubmitting(false); }
    }
    async function verify(domain: TenantDomainRecord) {
        try { const updated = await verifyTenantDomain(domain.id); setDomains((current) => current.map((item) => item.id === updated.id ? updated : item)); message.success("域名验证成功"); } catch (error) { message.error(error instanceof Error ? error.message : "域名验证失败"); }
    }
    async function setStatus(domain: TenantDomainRecord, status: "pending" | "disabled") {
        try { const updated = await updateTenantDomain(domain.id, status); setDomains((current) => current.map((item) => item.id === updated.id ? updated : item)); } catch (error) { message.error(error instanceof Error ? error.message : "域名状态更新失败"); }
    }
    async function remove(domain: TenantDomainRecord) {
        try { await deleteTenantDomain(domain.id); setDomains((current) => current.filter((item) => item.id !== domain.id)); message.success("域名已删除"); } catch (error) { message.error(error instanceof Error ? error.message : "域名删除失败"); }
    }

    return <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Globe2 className="size-4" /><h2 className="font-semibold">域名管理</h2></div><Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void refresh()}>刷新</Button></div>
        {canManage ? <div className="mb-4 flex flex-wrap gap-2"><Input value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="例如 app.example.com" className="max-w-sm" onPressEnter={() => void add()} /><Segmented value={kind} onChange={(value) => setKind(value as "custom" | "subdomain")} options={[{ label: "自定义域名", value: "custom" }, { label: "子域名", value: "subdomain" }]} /><Button type="primary" icon={<Plus className="size-4" />} loading={submitting} onClick={() => void add()}>添加</Button></div> : null}
        <div className="space-y-2">{domains.map((domain) => <div key={domain.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900"><div><div className="font-mono text-sm">{domain.hostname}</div><div className="mt-1 text-xs text-zinc-500">验证 TXT：{domain.verificationToken}</div></div><div className="flex items-center gap-2"><Tag color={domain.status === "verified" ? "green" : domain.status === "disabled" ? "default" : "gold"}>{domain.status === "verified" ? "已验证" : domain.status === "disabled" ? "已停用" : "待验证"}</Tag>{canManage && domain.status === "pending" ? <Button size="small" onClick={() => void verify(domain)}>验证 TXT</Button> : null}{canManage && domain.status !== "disabled" && domain.status !== "pending" ? <Button size="small" onClick={() => void setStatus(domain, "disabled")}>停用</Button> : null}{canManage && domain.status === "disabled" ? <Button size="small" onClick={() => void setStatus(domain, "pending")}>启用</Button> : null}{canManage && domain.status !== "verified" ? <Button size="small" danger onClick={() => void remove(domain)}>删除</Button> : null}</div></div>)}</div>
        {!loading && domains.length === 0 ? <div className="py-8 text-center text-sm text-zinc-500">暂无域名</div> : null}
    </section>;
}
