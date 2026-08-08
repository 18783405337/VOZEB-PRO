"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Empty, Spin, Table, Tabs, Tag } from "antd";
import type { TableColumnsType } from "antd";
import {
    CircleGauge,
    CreditCard,
    FileSearch,
    Landmark,
    ReceiptText,
    RefreshCw,
    WalletCards,
} from "lucide-react";

import type { TenantBillingOverview } from "@/services/api/tenant-billing";
import { getTenantBillingOverview } from "@/services/api/tenant-billing";

export function TenantBillingClient({ tenantName, tenantSlug }: { tenantName: string; tenantSlug: string }) {
    const [overview, setOverview] = useState<TenantBillingOverview>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(undefined);
        try {
            setOverview(await getTenantBillingOverview());
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : "租户账单加载失败");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const items = useMemo(
        () => [
            { key: "wallets", label: <TabLabel icon={<WalletCards className="size-4" />} text="钱包" />, children: <WalletsView overview={overview} loading={loading} /> },
            { key: "power", label: <TabLabel icon={<CircleGauge className="size-4" />} text="算力" />, children: <PowerView overview={overview} loading={loading} /> },
            { key: "settlement", label: <TabLabel icon={<Landmark className="size-4" />} text="结算" />, children: <SettlementView overview={overview} loading={loading} /> },
            { key: "orders", label: <TabLabel icon={<ReceiptText className="size-4" />} text="订单" />, children: <OrdersView overview={overview} loading={loading} /> },
            { key: "merchants", label: <TabLabel icon={<CreditCard className="size-4" />} text="商户" />, children: <MerchantsView overview={overview} loading={loading} /> },
            { key: "reconciliation", label: <TabLabel icon={<FileSearch className="size-4" />} text="对账" />, children: <ReconciliationView overview={overview} loading={loading} /> },
        ],
        [loading, overview],
    );

    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-[1480px] flex-col px-4 py-5 sm:px-6 lg:px-8">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-semibold text-zinc-950 sm:text-2xl dark:text-zinc-100">{tenantName}</h1>
                        <Tag>{tenantSlug}</Tag>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">租户账单</p>
                </div>
                <Button aria-label="刷新租户账单" title="刷新租户账单" icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void refresh()} />
            </header>

            <div className="min-w-0 flex-1 py-6">
                {error ? <Alert className="mb-4" type="error" showIcon message={error} action={<Button size="small" onClick={() => void refresh()}>重试</Button>} /> : null}
                {loading && !overview ? (
                    <div className="flex min-h-56 items-center justify-center"><Spin size="large" /></div>
                ) : (
                    <Tabs destroyOnHidden items={items} />
                )}
            </div>
        </div>
    );
}

function WalletsView({ overview, loading }: ViewProps) {
    const columns: TableColumnsType<NonNullable<TenantBillingOverview>["wallets"][number]> = [
        { title: "账户", dataIndex: "id", render: (value: string) => <span className="font-mono text-xs">{value}</span> },
        { title: "用户", dataIndex: "userId", render: (value?: string) => value || "未绑定用户" },
        { title: "可用余额", key: "available", render: (_, record) => formatLedgerAmount(record.availableAmount, record.currency || "POINT") },
        { title: "冻结余额", key: "reserved", render: (_, record) => formatLedgerAmount(record.reservedAmount, record.currency || "POINT") },
        { title: "币种", dataIndex: "currency", render: (value?: string) => value || "-" },
        { title: "更新时间", dataIndex: "updatedAt", render: (value: number) => formatTimestamp(value) },
    ];
    return <LedgerTable rowKey="id" columns={columns} dataSource={overview?.wallets || []} loading={loading} emptyDescription="暂无钱包账户" />;
}

function PowerView({ overview, loading }: ViewProps) {
    const columns: TableColumnsType<NonNullable<TenantBillingOverview>["power"][number]> = [
        { title: "账户", dataIndex: "id", render: (value: string) => <span className="font-mono text-xs">{value}</span> },
        { title: "算力单位", dataIndex: "unit", render: (value?: string) => value || "-" },
        { title: "可用算力", key: "available", render: (_, record) => formatLedgerAmount(record.availableAmount, record.unit || "unit") },
        { title: "冻结算力", key: "reserved", render: (_, record) => formatLedgerAmount(record.reservedAmount, record.unit || "unit") },
        { title: "更新时间", dataIndex: "updatedAt", render: (value: number) => formatTimestamp(value) },
    ];
    return <LedgerTable rowKey="id" columns={columns} dataSource={overview?.power || []} loading={loading} emptyDescription="暂无算力账户" />;
}

function SettlementView({ overview, loading }: ViewProps) {
    const columns: TableColumnsType<NonNullable<TenantBillingOverview>["settlement"][number]> = [
        { title: "结算账户", dataIndex: "id", render: (value: string) => <span className="font-mono text-xs">{value}</span> },
        { title: "币种", dataIndex: "currency", render: (value?: string) => value || "-" },
        { title: "应收余额", key: "available", render: (_, record) => formatLedgerAmount(record.availableAmount, record.currency || "CNY") },
        { title: "冻结余额", key: "reserved", render: (_, record) => formatLedgerAmount(record.reservedAmount, record.currency || "CNY") },
        { title: "更新时间", dataIndex: "updatedAt", render: (value: number) => formatTimestamp(value) },
    ];
    return <LedgerTable rowKey="id" columns={columns} dataSource={overview?.settlement || []} loading={loading} emptyDescription="暂无结算账户" />;
}

function OrdersView({ overview, loading }: ViewProps) {
    const columns: TableColumnsType<NonNullable<TenantBillingOverview>["orders"]["items"][number]> = [
        { title: "订单号", dataIndex: "orderNo", render: (value: string) => <span className="font-mono text-xs">{value}</span> },
        { title: "商品", dataIndex: "subject", render: (value: string) => <span className="font-medium">{value}</span> },
        { title: "用户", key: "user", render: (_, record) => record.userDisplayName || record.userUsername || record.userAccountId || record.userId || "-" },
        { title: "金额", key: "amount", render: (_, record) => formatMoney(record.amountCents, record.currency) },
        { title: "收款模式", dataIndex: "collectionMode", render: (value?: string) => <Tag color={value === "tenant" ? "blue" : "green"}>{value === "tenant" ? "租户直收" : "平台代收"}</Tag> },
        { title: "状态", dataIndex: "status", render: (value: string) => <Tag color={orderStatusColor(value)}>{orderStatusLabel(value)}</Tag> },
        { title: "创建时间", dataIndex: "createdAt", render: (value: string) => formatTimestamp(value) },
    ];
    return <PagedTable rowKey="id" columns={columns} dataSource={overview?.orders.items || []} loading={loading} emptyDescription="暂无订单" />;
}

function MerchantsView({ overview, loading }: ViewProps) {
    const columns: TableColumnsType<NonNullable<TenantBillingOverview>["merchants"][number]> = [
        { title: "商户账户", dataIndex: "id", render: (value: string) => <span className="font-mono text-xs">{value}</span> },
        { title: "渠道", dataIndex: "provider" },
        { title: "环境", dataIndex: "environment", render: (value: string) => <Tag color={value === "production" ? "red" : "gold"}>{value === "production" ? "生产" : "测试"}</Tag> },
        { title: "状态", dataIndex: "status", render: (value: string) => <Tag color={value === "enabled" ? "green" : "default"}>{value === "enabled" ? "启用" : "停用"}</Tag> },
        { title: "已配置字段", dataIndex: "configuredFields", render: (value: string[]) => value.length ? value.join("、") : "未配置" },
    ];
    return <LedgerTable rowKey="id" columns={columns} dataSource={overview?.merchants || []} loading={loading} emptyDescription="暂无商户账户" />;
}

function ReconciliationView({ overview, loading }: ViewProps) {
    const columns: TableColumnsType<NonNullable<TenantBillingOverview>["reconciliation"]["items"][number]> = [
        { title: "批次", dataIndex: "id", render: (value: string) => <span className="font-mono text-xs">{value}</span> },
        { title: "渠道", dataIndex: "provider" },
        { title: "来源", dataIndex: "source" },
        { title: "状态", dataIndex: "status", render: (value: string) => <Tag color={value === "completed" ? "green" : "red"}>{value === "completed" ? "完成" : "失败"}</Tag> },
        { title: "总行数", dataIndex: "totalRows" },
        { title: "问题行", dataIndex: "issueRows", render: (value: number) => <Tag color={value ? "red" : "green"}>{value}</Tag> },
        { title: "差异", key: "difference", render: (_, record) => formatMoney(record.differenceAmountCents, "CNY") },
        { title: "创建时间", dataIndex: "createdAt", render: (value: string) => formatTimestamp(value) },
    ];
    return <PagedTable rowKey="id" columns={columns} dataSource={overview?.reconciliation.items || []} loading={loading} emptyDescription="暂无对账批次" />;
}

function LedgerTable<T extends object>({ rowKey, columns, dataSource, loading, emptyDescription }: { rowKey: string; columns: TableColumnsType<T>; dataSource: T[]; loading: boolean; emptyDescription: string }) {
    return (
        <Table<T>
            rowKey={rowKey}
            columns={columns}
            dataSource={dataSource}
            loading={loading}
            pagination={false}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} /> }}
            scroll={{ x: 720 }}
            size="middle"
        />
    );
}

function PagedTable<T extends object>({ rowKey, columns, dataSource, loading, emptyDescription }: { rowKey: string; columns: TableColumnsType<T>; dataSource: T[]; loading: boolean; emptyDescription: string }) {
    return (
        <Table<T>
            rowKey={rowKey}
            columns={columns}
            dataSource={dataSource}
            loading={loading}
            pagination={false}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} /> }}
            scroll={{ x: 980 }}
            size="middle"
        />
    );
}

function TabLabel({ icon, text }: { icon: ReactNode; text: string }) {
    return <span className="inline-flex items-center gap-2">{icon}{text}</span>;
}

type ViewProps = {
    overview?: TenantBillingOverview;
    loading: boolean;
};

function formatLedgerAmount(value: number, unit: string) {
    return `${new Intl.NumberFormat("zh-CN").format(value)} ${unit}`;
}

function formatMoney(value: number, currency: string) {
    try {
        return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(value / 100);
    } catch {
        return `${(value / 100).toFixed(2)} ${currency}`;
    }
}

function formatTimestamp(value: number | string) {
    const date = typeof value === "number" ? new Date(value) : new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN");
}

function orderStatusLabel(value: string) {
    if (value === "partially_refunded") return "部分退款";
    return { pending: "待支付", paid: "已支付", closed: "已关闭", canceled: "已取消", refunding: "退款中", refunded: "已退款" }[value] || value;
}

function orderStatusColor(value: string) {
    if (value === "partially_refunded") return "gold";
    return { pending: "gold", paid: "green", closed: "default", canceled: "default", refunding: "orange", refunded: "blue" }[value] || "default";
}
