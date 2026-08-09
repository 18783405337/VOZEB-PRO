"use client";

import { useEffect, useState } from "react";
import { App, Button, Form, Input, Switch } from "antd";
import { Save } from "lucide-react";

import type { TenantSettings } from "@/services/api/tenant-settings";
import { getTenantSettings, updateTenantSettings } from "@/services/api/tenant-settings";

export function TenantSettingsSection({ canManage }: { canManage: boolean }) {
    const { message } = App.useApp();
    const [form] = Form.useForm<TenantSettings>();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    useEffect(() => { void getTenantSettings().then(({ settings }) => form.setFieldsValue(settings)).catch((error) => message.error(error instanceof Error ? error.message : "配置加载失败")).finally(() => setLoading(false)); }, [form, message]);
    async function save(values: TenantSettings) { setSaving(true); try { const result = await updateTenantSettings(values); form.setFieldsValue(result.settings); message.success("租户配置已保存"); } catch (error) { message.error(error instanceof Error ? error.message : "配置保存失败"); } finally { setSaving(false); } }
    return <section className="max-w-3xl rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><div className="mb-4"><h2 className="font-semibold">租户资料与品牌</h2><p className="mt-1 text-xs text-zinc-500">配置租户名称、品牌资源、联系方式和存储能力。</p></div><Form form={form} layout="vertical" onFinish={save} disabled={!canManage || loading}><Form.Item name="title" label="站点标题"><Input maxLength={160} /></Form.Item><Form.Item name="logoUrl" label="Logo URL"><Input maxLength={1000} /></Form.Item><Form.Item name="iconUrl" label="图标 URL"><Input maxLength={1000} /></Form.Item><Form.Item name="siteUrl" label="站点地址"><Input maxLength={1000} placeholder="https://tenant.example.com" /></Form.Item><Form.Item name="phone" label="联系电话"><Input maxLength={64} /></Form.Item><Form.Item name="notes" label="备注"><Input.TextArea maxLength={1000} rows={4} /></Form.Item><Form.Item name="allowCustomStorage" label="允许自定义对象存储" valuePropName="checked"><Switch /></Form.Item><Form.Item name="allowLocalStorage" label="允许本地存储" valuePropName="checked"><Switch /></Form.Item>{canManage ? <Button type="primary" icon={<Save className="size-4" />} loading={saving} htmlType="submit">保存配置</Button> : null}</Form></section>;
}
