"use client";

import { useState } from "react";
import { App, Button, Checkbox, Form, Input, Modal, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { Plus, RefreshCw, ShieldCheck } from "lucide-react";

import { TENANT_PERMISSIONS } from "@/lib/server/authorization/permission-catalog";
import type { TenantRoleRecord } from "@/lib/server/tenant/tenant-types";
import { createTenantRole } from "@/services/api/tenant-admin";

type RoleFormValue = {
    key: string;
    name: string;
    permissions: string[];
};

const permissionLabels: Record<(typeof TENANT_PERMISSIONS)[number], string> = {
    "tenant.members.read": "查看成员",
    "tenant.members.manage": "管理成员",
    "tenant.roles.manage": "管理角色",
    "tenant.apps.read": "查看应用",
    "tenant.apps.configure": "配置应用",
    "tenant.billing.read": "查看账单",
    "tenant.merchants.manage": "管理商户",
};

export function TenantRolesSection({
    roles,
    loading,
    canManage,
    error,
    onRefresh,
}: {
    roles: TenantRoleRecord[];
    loading: boolean;
    canManage: boolean;
    error?: string;
    onRefresh: () => Promise<void>;
}) {
    const { message } = App.useApp();
    const [form] = Form.useForm<RoleFormValue>();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const columns: TableColumnsType<TenantRoleRecord> = [
        {
            title: "角色",
            dataIndex: "name",
            render: (value: string, record) => (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
                    {record.system ? <Tag>系统角色</Tag> : null}
                </div>
            ),
        },
        {
            title: "标识",
            dataIndex: "key",
            width: 160,
            render: (value: string) => <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{value}</span>,
        },
        {
            title: "权限",
            dataIndex: "permissions",
            render: (permissions: string[]) => (
                <div className="flex flex-wrap gap-1">
                    {permissions.length ? permissions.map((permission) => <Tag key={permission}>{permissionLabels[permission as keyof typeof permissionLabels] || permission}</Tag>) : <span className="text-xs text-zinc-400">无</span>}
                </div>
            ),
        },
    ];

    async function submit(value: RoleFormValue) {
        setSubmitting(true);
        try {
            await createTenantRole({
                key: value.key.trim().toLowerCase(),
                name: value.name.trim(),
                permissions: value.permissions || [],
            });
            message.success("角色已创建");
            setOpen(false);
            form.resetFields();
            await onRefresh();
        } catch (submitError) {
            message.error(submitError instanceof Error ? submitError.message : "角色创建失败");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        <ShieldCheck className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">角色</h2>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">通过权限组合定义当前租户的管理职责。</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void onRefresh()}>
                        刷新
                    </Button>
                    <Button type="primary" icon={<Plus className="size-4" />} disabled={!canManage} onClick={() => setOpen(true)}>
                        新建角色
                    </Button>
                </div>
            </div>
            {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
            <Table<TenantRoleRecord> rowKey="id" columns={columns} dataSource={roles} loading={loading} pagination={false} scroll={{ x: 760 }} size="middle" />
            <Modal title="新建租户角色" open={open} okText="创建" cancelText="取消" confirmLoading={submitting} onCancel={() => setOpen(false)} onOk={() => void form.submit()} destroyOnHidden>
                <Form form={form} layout="vertical" className="pt-3" initialValues={{ permissions: [] }} onFinish={submit}>
                    <Form.Item name="name" label="角色名称" rules={[{ required: true, message: "请输入角色名称" }]}>
                        <Input autoComplete="off" placeholder="例如：内容编辑" />
                    </Form.Item>
                    <Form.Item name="key" label="角色标识" rules={[{ required: true, pattern: /^[a-z0-9][a-z0-9_-]{0,62}$/, message: "使用小写字母、数字、下划线或连字符" }]}>
                        <Input autoComplete="off" placeholder="例如：content_editor" />
                    </Form.Item>
                    <Form.Item name="permissions" label="权限">
                        <Checkbox.Group className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {TENANT_PERMISSIONS.map((permission) => (
                                <Checkbox key={permission} value={permission}>
                                    {permissionLabels[permission]}
                                </Checkbox>
                            ))}
                        </Checkbox.Group>
                    </Form.Item>
                </Form>
            </Modal>
        </section>
    );
}
