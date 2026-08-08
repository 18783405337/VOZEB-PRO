"use client";

import { useEffect, useState } from "react";
import { Alert, App, Button, Form, Input, InputNumber, Select, Switch, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { Check, CircleDollarSign, Download, RefreshCw, Route, Settings2, Trash2 } from "lucide-react";

import type { AppField } from "@/lib/apps/app-definition";
import { SPECIALIZED_PROVIDER_APP_KEYS } from "@/lib/auth/store-types";
import type { TenantApplication, TenantApplicationCatalog, TenantApplicationProviderBindingState } from "@/services/api/app-center";
import {
    clearTenantApplicationProviderBinding,
    getTenantApplication,
    getTenantApplicationProviderBinding,
    installTenantApp,
    listTenantApplications,
    saveTenantApplicationPricing,
    saveTenantApplicationProviderBinding,
    saveTenantApplicationSettings,
    setTenantApplicationStatus,
} from "@/services/api/app-center";

type SettingsFormValue = Record<string, unknown>;
type PricingFormValue = {
    currency: string;
    saleUnit: string;
    saleAmount: number;
    collectionMode: "platform" | "tenant";
};

export function TenantAppCenterSection({ canConfigure }: { canConfigure: boolean }) {
    const { message } = App.useApp();
    const [catalog, setCatalog] = useState<TenantApplicationCatalog>({ available: [], installed: [] });
    const [selectedKey, setSelectedKey] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [providerLoading, setProviderLoading] = useState(false);
    const [providerSaving, setProviderSaving] = useState(false);
    const [providerBindingState, setProviderBindingState] = useState<TenantApplicationProviderBindingState | null>(null);
    const [providerSelection, setProviderSelection] = useState<string>();
    const [settingsForm] = Form.useForm<SettingsFormValue>();
    const [pricingForm] = Form.useForm<PricingFormValue>();
    const selected = catalog.installed.find((item) => item.appKey === selectedKey);
    const selectedDefinition = catalog.available.find((item) => item.appKey === selectedKey)?.definition;

    async function refresh() {
        setLoading(true);
        try {
            const nextCatalog = await listTenantApplications();
            setCatalog(nextCatalog);
            setSelectedKey((current) => current && nextCatalog.installed.some((item) => item.appKey === current) ? current : nextCatalog.installed[0]?.appKey);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "应用加载失败");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void refresh();
    }, []);

    useEffect(() => {
        if (!selected) return;
        settingsForm.setFieldsValue(selected.settings);
        pricingForm.setFieldsValue(selected.pricing || { currency: "POINT", saleUnit: "task", saleAmount: 0, collectionMode: "platform" });
    }, [pricingForm, selected, settingsForm]);

    useEffect(() => {
        if (!selectedKey || !isSpecializedProviderApp(selectedKey)) {
            setProviderBindingState(null);
            setProviderSelection(undefined);
            return;
        }
        let cancelled = false;
        setProviderLoading(true);
        void getTenantApplicationProviderBinding(selectedKey)
            .then((next) => {
                if (cancelled) return;
                setProviderBindingState(next);
                setProviderSelection(next.binding?.logicalModelKey);
            })
            .catch((error) => {
                if (cancelled) return;
                setProviderBindingState(null);
                setProviderSelection(undefined);
                message.error(error instanceof Error ? error.message : "模型 API 订阅加载失败");
            })
            .finally(() => {
                if (!cancelled) setProviderLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [message, selectedKey]);

    async function install(appKey: string, version: string) {
        setSaving(true);
        try {
            await installTenantApp(appKey, version);
            message.success("应用已安装");
            await refresh();
            setSelectedKey(appKey);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "应用安装失败");
        } finally {
            setSaving(false);
        }
    }

    async function updateStatus(appKey: string, status: TenantApplication["status"]) {
        setSaving(true);
        try {
            const updated = await setTenantApplicationStatus(appKey, status);
            setCatalog((current) => ({ ...current, installed: current.installed.map((item) => item.appKey === appKey ? { ...item, ...updated } : item) }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "应用状态更新失败");
        } finally {
            setSaving(false);
        }
    }

    async function saveSettings(values: SettingsFormValue) {
        if (!selected) return;
        setSaving(true);
        try {
            await saveTenantApplicationSettings(selected.appKey, { settings: values });
            message.success("应用设置已保存");
            await refreshSelected(selected.appKey);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "应用设置保存失败");
        } finally {
            setSaving(false);
        }
    }

    async function savePricing(values: PricingFormValue) {
        if (!selected) return;
        setSaving(true);
        try {
            await saveTenantApplicationPricing(selected.appKey, values);
            message.success("应用计费已保存");
            await refreshSelected(selected.appKey);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "应用计费保存失败");
        } finally {
            setSaving(false);
        }
    }

    async function refreshSelected(appKey: string) {
        const next = await getTenantApplication(appKey);
        setCatalog((current) => ({ ...current, installed: current.installed.map((item) => item.appKey === appKey ? next : item) }));
    }

    async function saveProviderBinding() {
        if (!selected || !providerSelection) return;
        setProviderSaving(true);
        try {
            const next = await saveTenantApplicationProviderBinding(selected.appKey, providerSelection);
            setProviderBindingState(next);
            setProviderSelection(next.binding?.logicalModelKey);
            message.success("模型 API 订阅已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "模型 API 订阅保存失败");
        } finally {
            setProviderSaving(false);
        }
    }

    async function clearProviderBinding() {
        if (!selected) return;
        setProviderSaving(true);
        try {
            const next = await clearTenantApplicationProviderBinding(selected.appKey);
            setProviderBindingState(next);
            setProviderSelection(undefined);
            message.success("模型 API 订阅已清除");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "模型 API 订阅清除失败");
        } finally {
            setProviderSaving(false);
        }
    }

    const availableColumns: TableColumnsType<TenantApplicationCatalog["available"][number]> = [
        {
            title: "应用",
            key: "app",
            render: (_, record) => <div><div className="font-medium text-zinc-900 dark:text-zinc-100">{record.definition.name}</div><div className="mt-1 text-xs text-zinc-500">{record.definition.category} · {record.appKey}</div></div>,
        },
        { title: "版本", dataIndex: "version", width: 100, render: (value: string) => <span className="font-mono text-xs">{value}</span> },
        { title: "计量", key: "billing", width: 150, render: (_, record) => `${record.definition.defaultPricing.saleAmount} ${record.definition.defaultPricing.currency}/${record.definition.defaultPricing.saleUnit}` },
        {
            title: "操作",
            key: "actions",
            width: 110,
            render: (_, record) => catalog.installed.some((item) => item.appKey === record.appKey)
                ? <Tag color="green">已安装</Tag>
                : <Button type="primary" size="small" icon={<Download className="size-3.5" />} disabled={!canConfigure || saving} onClick={() => void install(record.appKey, record.version)}>安装</Button>,
        },
    ];

    const installedColumns: TableColumnsType<TenantApplication> = [
        {
            title: "应用",
            key: "app",
            render: (_, record) => {
                const definition = catalog.available.find((item) => item.appKey === record.appKey)?.definition;
                return <div><div className="font-medium">{definition?.name || record.appKey}</div><div className="mt-1 font-mono text-xs text-zinc-500">{record.appKey}@{record.version}</div></div>;
            },
        },
        { title: "状态", dataIndex: "status", width: 100, render: (value: TenantApplication["status"]) => <Tag color={value === "enabled" ? "green" : "default"}>{value === "enabled" ? "启用" : "停用"}</Tag> },
        {
            title: "操作",
            key: "actions",
            width: 150,
            render: (_, record) => <div className="flex items-center gap-2"><Switch checked={record.status === "enabled"} disabled={!canConfigure || saving} onChange={(checked) => void updateStatus(record.appKey, checked ? "enabled" : "disabled")} /><Button type={record.appKey === selectedKey ? "primary" : "default"} size="small" icon={<Settings2 className="size-3.5" />} onClick={() => setSelectedKey(record.appKey)}>配置</Button></div>,
        },
    ];

    return (
        <section className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><Settings2 className="size-4" /></span>
                    <div><h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">应用中心</h2><p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">安装和配置当前租户可用的工作流应用</p></div>
                </div>
                <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void refresh()}>刷新</Button>
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <div className="min-w-0 space-y-6">
                    <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">可用应用</h3><Tag>{catalog.available.length}</Tag></div><Table rowKey={(record) => `${record.appKey}@${record.version}`} columns={availableColumns} dataSource={catalog.available} loading={loading || saving} pagination={false} scroll={{ x: 620 }} size="middle" /></div>
                    <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">已安装应用</h3><Tag>{catalog.installed.length}</Tag></div><Table rowKey="id" columns={installedColumns} dataSource={catalog.installed} loading={loading || saving} pagination={false} scroll={{ x: 560 }} size="middle" /></div>
                </div>
                <div className="min-w-0 border-l border-zinc-200 pl-0 xl:pl-6 dark:border-zinc-800">
                    {selected && selectedDefinition ? <div className="space-y-6">
                        <div><div className="flex items-center gap-2"><h3 className="text-base font-semibold">{selectedDefinition.name}</h3><Tag color={selected.status === "enabled" ? "green" : "default"}>{selected.status === "enabled" ? "启用" : "停用"}</Tag></div><p className="mt-1 font-mono text-xs text-zinc-500">{selected.appKey}@{selected.version}</p></div>
                        {isSpecializedProviderApp(selected.appKey) ? (
                            <div>
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                    <Route className="size-4" />
                                    模型 API 订阅
                                </div>
                                {!providerLoading && !providerBindingState?.binding ? (
                                    <Alert
                                        className="mb-3"
                                        type="warning"
                                        showIcon
                                        message="尚未订阅模型 API"
                                        description={providerBindingState?.available.length ? "请选择一个可用逻辑 API 后保存。" : "超级管理员尚未为该应用配置可用逻辑 API。"}
                                    />
                                ) : null}
                                <Select
                                    className="w-full"
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    loading={providerLoading}
                                    disabled={!canConfigure || providerLoading || providerSaving}
                                    value={providerSelection}
                                    placeholder="选择逻辑 API"
                                    notFoundContent={providerLoading ? "正在加载" : "暂无可用逻辑 API"}
                                    options={(providerBindingState?.available || []).map((item) => ({ label: item.name, value: item.logicalModelKey }))}
                                    onChange={(value) => setProviderSelection(value)}
                                />
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button type="primary" icon={<Check className="size-4" />} loading={providerSaving} disabled={!canConfigure || !providerSelection || providerLoading} onClick={() => void saveProviderBinding()}>
                                        保存订阅
                                    </Button>
                                    <Button
                                        danger
                                        icon={<Trash2 className="size-4" />}
                                        loading={providerSaving}
                                        disabled={!canConfigure || !providerBindingState?.binding || providerLoading}
                                        onClick={() => void clearProviderBinding()}
                                    >
                                        清除订阅
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                        <Form form={settingsForm} layout="vertical" onFinish={saveSettings} disabled={!canConfigure}><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Settings2 className="size-4" />运行设置</div>{selectedDefinition.inputSchema.map((field) => <AppFieldControl key={field.key} field={field} />)}<Button type="primary" htmlType="submit" loading={saving} icon={<Check className="size-4" />}>保存设置</Button></Form>
                        <Form form={pricingForm} layout="vertical" onFinish={savePricing} disabled={!canConfigure}><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CircleDollarSign className="size-4" />计费设置</div><div className="grid gap-3 sm:grid-cols-2"><Form.Item name="currency" label="币种" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="saleUnit" label="计费单位" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="saleAmount" label="单价" rules={[{ required: true }]}><InputNumber className="w-full" min={0} precision={0} /></Form.Item><Form.Item name="collectionMode" label="收款归属" rules={[{ required: true }]}><Select options={[{ label: "平台", value: "platform" }, { label: "租户", value: "tenant" }]} /></Form.Item></div><Button type="primary" htmlType="submit" loading={saving} icon={<Check className="size-4" />}>保存计费</Button></Form>
                    </div> : <div className="flex min-h-56 items-center justify-center text-sm text-zinc-500">选择一个已安装应用进行配置</div>}
                </div>
            </div>
        </section>
    );
}

function AppFieldControl({ field }: { field: AppField }) {
    if (field.kind === "select") return <Form.Item name={field.key} label={field.label} rules={[{ required: field.required }]}><Select options={field.options.map((option) => ({ label: option, value: option }))} /></Form.Item>;
    if (field.kind === "number") return <Form.Item name={field.key} label={field.label} rules={[{ required: field.required }]}><InputNumber className="w-full" min={field.min} max={field.max} /></Form.Item>;
    const placeholder = field.kind === "image"
        ? "输入图片地址"
        : field.kind === "audio"
          ? "输入音频地址"
          : field.kind === "video"
            ? "输入视频地址"
            : undefined;
    return <Form.Item name={field.key} label={field.label} rules={[{ required: field.required, max: field.kind === "text" ? field.maxLength : undefined }]}><Input placeholder={placeholder} /></Form.Item>;
}

function isSpecializedProviderApp(appKey: string) {
    return SPECIALIZED_PROVIDER_APP_KEYS.some((item) => item === appKey);
}
