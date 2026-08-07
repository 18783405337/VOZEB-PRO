"use client";

import { useMemo, useState } from "react";
import { App, Button, Form, Input, Modal, Select, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { Plus, RefreshCw, UsersRound } from "lucide-react";

import type { TenantMemberRecord, TenantRoleRecord } from "@/lib/server/tenant/tenant-types";
import { addTenantMember } from "@/services/api/tenant-admin";

type MemberFormValue = {
    userId: string;
    roleId: string;
};

export function TenantMembersSection({
    members,
    roles,
    loading,
    canManage,
    error,
    onRefresh,
}: {
    members: TenantMemberRecord[];
    roles: TenantRoleRecord[];
    loading: boolean;
    canManage: boolean;
    error?: string;
    onRefresh: () => Promise<void>;
}) {
    const { message } = App.useApp();
    const [form] = Form.useForm<MemberFormValue>();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const roleNames = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);
    const assignableRoles = roles.filter((role) => role.key !== "owner");
    const columns: TableColumnsType<TenantMemberRecord> = [
        {
            title: "用户 ID",
            dataIndex: "userId",
            render: (value: string) => <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{value}</span>,
        },
        {
            title: "角色",
            dataIndex: "roleId",
            render: (value: string, record) => (
                <div className="flex items-center gap-2">
                    <span>{roleNames.get(value) || record.roleKey}</span>
                    {record.roleKey === "owner" ? <Tag color="gold">所有者</Tag> : null}
                </div>
            ),
        },
        {
            title: "状态",
            dataIndex: "status",
            width: 100,
            render: (value: TenantMemberRecord["status"]) => <Tag color={value === "active" ? "green" : "default"}>{value === "active" ? "可用" : "停用"}</Tag>,
        },
        {
            title: "加入时间",
            dataIndex: "joinedAt",
            width: 180,
            render: (value: string) => new Date(value).toLocaleString("zh-CN"),
        },
    ];

    async function submit(value: MemberFormValue) {
        setSubmitting(true);
        try {
            await addTenantMember({ userId: value.userId.trim(), roleId: value.roleId });
            message.success("成员已保存");
            setOpen(false);
            form.resetFields();
            await onRefresh();
        } catch (submitError) {
            message.error(submitError instanceof Error ? submitError.message : "成员保存失败");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        <UsersRound className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">成员</h2>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">为当前租户分配成员和已有角色。</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void onRefresh()}>
                        刷新
                    </Button>
                    <Button type="primary" icon={<Plus className="size-4" />} disabled={!canManage || assignableRoles.length === 0} onClick={() => setOpen(true)}>
                        添加成员
                    </Button>
                </div>
            </div>
            {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
            <Table<TenantMemberRecord> rowKey={(record) => `${record.tenantId}:${record.userId}`} columns={columns} dataSource={members} loading={loading} pagination={false} scroll={{ x: 720 }} size="middle" />
            <Modal title="添加或调整成员" open={open} okText="保存" cancelText="取消" confirmLoading={submitting} onCancel={() => setOpen(false)} onOk={() => void form.submit()} destroyOnHidden>
                <Form form={form} layout="vertical" className="pt-3" onFinish={submit}>
                    <Form.Item name="userId" label="用户 ID" rules={[{ required: true, message: "请输入用户 ID" }]}>
                        <Input autoComplete="off" placeholder="输入平台用户 ID" />
                    </Form.Item>
                    <Form.Item name="roleId" label="租户角色" rules={[{ required: true, message: "请选择租户角色" }]}>
                        <Select placeholder="选择角色" options={assignableRoles.map((role) => ({ value: role.id, label: role.name }))} />
                    </Form.Item>
                </Form>
            </Modal>
        </section>
    );
}
