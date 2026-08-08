"use client";

import { useEffect, useState } from "react";
import { App, Button, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { RefreshCw, UploadCloud } from "lucide-react";

import type { AdminApplication } from "@/services/api/app-center";
import { listAdminApplications, publishApplicationVersion } from "@/services/api/app-center";

export function AdminAppCenterSection() {
    const { message } = App.useApp();
    const [apps, setApps] = useState<AdminApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState<string>();

    async function refresh() {
        setLoading(true);
        try {
            setApps(await listAdminApplications());
        } catch (error) {
            message.error(error instanceof Error ? error.message : "应用列表加载失败");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void refresh();
    }, []);

    async function publish(app: AdminApplication) {
        setPublishing(app.appKey);
        try {
            await publishApplicationVersion(app.appKey, app.version);
            message.success("应用版本已发布");
            await refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "应用发布失败");
        } finally {
            setPublishing(undefined);
        }
    }

    const columns: TableColumnsType<AdminApplication> = [
        {
            title: "应用",
            key: "app",
            render: (_, record) => <div><div className="font-medium text-zinc-900 dark:text-zinc-100">{record.definition.name}</div><div className="mt-1 text-xs text-zinc-500">{record.appKey} · {record.definition.category}</div></div>,
        },
        { title: "审核版本", dataIndex: "version", width: 110, render: (value: string) => <span className="font-mono text-xs">{value}</span> },
        { title: "工作流", dataIndex: ["definition", "workflowKey"], width: 190, render: (value: string) => <span className="font-mono text-xs text-zinc-500">{value}</span> },
        { title: "状态", dataIndex: "published", width: 100, render: (value: boolean) => <Tag color={value ? "green" : "default"}>{value ? "已发布" : "待发布"}</Tag> },
        {
            title: "操作",
            key: "action",
            width: 120,
            render: (_, record) => <Button type="primary" size="small" icon={<UploadCloud className="size-3.5" />} loading={publishing === record.appKey} disabled={record.published || Boolean(publishing)} onClick={() => void publish(record)}>发布版本</Button>,
        },
    ];

    return (
        <section className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">应用中心</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">从审核注册表发布可供租户安装的应用版本</p></div>
                <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void refresh()}>刷新</Button>
            </div>
            <Table rowKey={(record) => `${record.appKey}@${record.version}`} columns={columns} dataSource={apps} loading={loading} pagination={false} scroll={{ x: 760 }} size="middle" />
        </section>
    );
}
