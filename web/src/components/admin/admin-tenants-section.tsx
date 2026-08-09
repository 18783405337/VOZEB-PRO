"use client";

import { useEffect, useState } from "react";
import { App, Button, Form, Input, Modal, Pagination, Select, Switch, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { Building2, Plus, RefreshCw } from "lucide-react";

import type { TenantListResult, TenantRecord, TenantStatus } from "@/lib/server/tenant/tenant-types";
import { AdminUserIdentity, AdminUserSearchSelect } from "./admin-user-identity";
import { createPlatformTenant, listPlatformTenants, updatePlatformTenant, updatePlatformTenantSettings } from "@/services/api/admin-tenants";

type TenantFormValue = {
    slug: string;
    name: string;
    ownerUserId?: string;
};

const PAGE_SIZE = 20;

export function AdminTenantsSection() {
    const { message } = App.useApp();
    const [form] = Form.useForm<TenantFormValue>();
    const [result, setResult] = useState<TenantListResult>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
    const [keyword, setKeyword] = useState("");
    const [status, setStatus] = useState<TenantStatus>();
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingTenant, setEditingTenant] = useState<TenantRecord>();
    const [settingsForm] = Form.useForm<Record<string, unknown>>();

    const load = async (page = result.page) => {
        setLoading(true);
        try {
            setResult(await listPlatformTenants({ keyword: keyword.trim(), ...(status ? { status } : {}), page, pageSize: PAGE_SIZE }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "租户列表加载失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load(1);
        // Search input is applied explicitly through onSearch; loading on every keystroke is intentionally avoided.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    async function submit(value: TenantFormValue) {
        setSubmitting(true);
        try {
            await createPlatformTenant({
                slug: value.slug.trim().toLowerCase(),
                name: value.name.trim(),
                ...(value.ownerUserId?.trim() ? { ownerUserId: value.ownerUserId.trim() } : {}),
            });
            message.success("租户已创建");
            setOpen(false);
            form.resetFields();
            await load(1);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "租户创建失败");
        } finally {
            setSubmitting(false);
        }
    }

    async function toggleStatus(tenant: TenantRecord) {
        try {
            const updated = await updatePlatformTenant(tenant.id, { status: tenant.status === "active" ? "disabled" : "active" });
            setResult((current) => ({ ...current, items: current.items.map((item) => item.id === updated.id ? updated : item) }));
            message.success(updated.status === "active" ? "租户已启用" : "租户已停用");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "租户状态更新失败");
        }
    }

    async function saveSettings(value: Record<string, unknown>) {
        if (!editingTenant) return;
        try {
            await updatePlatformTenantSettings(editingTenant.id, value);
            message.success("租户基础信息已保存");
            setEditingTenant(undefined);
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "租户基础信息保存失败");
        }
    }

    const columns: TableColumnsType<TenantRecord> = [
        {
            title: "租户",
            dataIndex: "name",
            render: (value: string, record) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">{value}</div>
                    <div className="truncate font-mono text-xs text-zinc-500">{record.slug}</div>
                </div>
            ),
        },
        {
            title: "状态",
            dataIndex: "status",
            width: 110,
            render: (value: TenantStatus) => <Tag color={value === "active" ? "green" : "default"}>{value === "active" ? "运行中" : "已停用"}</Tag>,
        },
        {
            title: "所有者",
            dataIndex: "ownerUserId",
            width: 220,
            render: (value?: string) => value ? <AdminUserIdentity username={value} accountId={value} fallback={value} /> : <span className="text-zinc-500">未设置</span>,
        },
        {
            title: "创建时间",
            dataIndex: "createdAt",
            width: 180,
            render: (value: string) => new Date(value).toLocaleString("zh-CN"),
        },
        {
            title: "操作",
            key: "actions",
            width: 110,
            render: (_, record) => (
                <div className="flex items-center gap-1">
                    <Button type="link" onClick={() => void toggleStatus(record)}>{record.status === "active" ? "停用" : "启用"}</Button>
                    <Button type="link" onClick={() => { setEditingTenant(record); settingsForm.setFieldsValue(record.settings); }}>基础信息</Button>
                </div>
            ),
        },
    ];

    return (
        <section className="min-w-0">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        <Building2 className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">平台租户</h2>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">创建、筛选和启停租户。成员与角色请进入租户管理页处理。</p>
                    </div>
                </div>
                <Button type="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>新建租户</Button>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Input.Search value={keyword} allowClear placeholder="按名称或标识搜索" className="w-full sm:w-72" onChange={(event) => setKeyword(event.target.value)} onSearch={() => void load(1)} />
                <Select allowClear value={status} placeholder="全部状态" className="w-32" options={[{ value: "active", label: "运行中" }, { value: "disabled", label: "已停用" }]} onChange={setStatus} />
                <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load()}>刷新</Button>
            </div>
            <Table<TenantRecord> rowKey="id" columns={columns} dataSource={result.items} loading={loading} pagination={false} scroll={{ x: 760 }} size="middle" />
            <div className="mt-4 flex justify-end">
                <Pagination current={result.page} pageSize={result.pageSize} total={result.total} showSizeChanger={false} onChange={(page) => void load(page)} />
            </div>
            <Modal title="租户基础信息" open={Boolean(editingTenant)} okText="保存" cancelText="取消" onCancel={() => setEditingTenant(undefined)} onOk={() => void settingsForm.submit()} destroyOnHidden>
                <Form form={settingsForm} layout="vertical" onFinish={saveSettings} className="pt-3">
                    <Form.Item name="title" label="站点标题"><Input /></Form.Item>
                    <Form.Item name="logoUrl" label="Logo 地址"><Input placeholder="https://..." /></Form.Item>
                    <Form.Item name="iconUrl" label="站点图标地址"><Input placeholder="https://..." /></Form.Item>
                    <Form.Item name="siteUrl" label="站点地址"><Input placeholder="https://..." /></Form.Item>
                    <Form.Item name="phone" label="联系电话"><Input /></Form.Item>
                    <Form.Item name="notes" label="备注"><Input.TextArea rows={3} /></Form.Item>
                    <Form.Item name="allowCustomStorage" label="允许自定义存储" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name="allowLocalStorage" label="允许本地存储" valuePropName="checked"><Switch /></Form.Item>
                </Form>
            </Modal>
            <Modal title="新建租户" open={open} okText="创建" cancelText="取消" confirmLoading={submitting} onCancel={() => setOpen(false)} onOk={() => void form.submit()} destroyOnHidden>
                <Form form={form} layout="vertical" className="pt-3" onFinish={submit}>
                    <Form.Item name="name" label="租户名称" rules={[{ required: true, message: "请输入租户名称" }]}>
                        <Input placeholder="例如：品牌设计团队" />
                    </Form.Item>
                    <Form.Item name="slug" label="租户标识" rules={[{ required: true, pattern: /^[a-z0-9][a-z0-9-]{0,62}$/, message: "使用小写字母、数字或连字符" }]}>
                        <Input placeholder="例如：brand-design" />
                    </Form.Item>
                    <Form.Item name="ownerUserId" label="租户所有者">
                        <AdminUserSearchSelect activeOnly placeholder="搜索并选择租户所有者" />
                    </Form.Item>
                </Form>
            </Modal>
        </section>
    );
}
