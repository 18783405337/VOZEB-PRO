"use client";

import { App, Button, Input, Segmented, Select, Spin } from "antd";
import { Clapperboard, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ClipType = "realman_broadcast" | "broadcast_mixcut" | "news_mixcut";
type Template = {
    id: string;
    clipType: ClipType;
    name: string;
    scene: string;
    description: string;
    defaultRatio: string;
    defaultDurationSeconds: number;
};
type Task = {
    id: string;
    clipType: ClipType;
    title: string;
    ratio: string;
    durationSeconds: number;
    quantity: number;
    status: string;
    progress: number;
    provider: string;
    createdAt: string;
};
type ApiEnvelope<T> = { code: number; data: T; msg: string };

const clipTypeOptions = [
    { value: "realman_broadcast", label: "真人口播混剪" },
    { value: "broadcast_mixcut", label: "素材混剪" },
    { value: "news_mixcut", label: "新闻体视频" },
] satisfies Array<{ value: ClipType; label: string }>;

export function SmartClipWorkspace() {
    const { message } = App.useApp();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [clipType, setClipType] = useState<ClipType>("realman_broadcast");
    const [styleId, setStyleId] = useState("");
    const [title, setTitle] = useState("");
    const [videoUri, setVideoUri] = useState("");
    const [audioUri, setAudioUri] = useState("");
    const [materials, setMaterials] = useState("");
    const [ratio, setRatio] = useState("duration");
    const [durationSeconds, setDurationSeconds] = useState(60);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [disabledMessage, setDisabledMessage] = useState("");
    const [estimate, setEstimate] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        setDisabledMessage("");
        try {
            const [configResponse, taskResponse] = await Promise.all([request<ApiEnvelope<{ templates: Template[] }>>("/api/smart-clip/config"), request<ApiEnvelope<{ items: Task[] }>>("/api/smart-clip/tasks")]);
            setTemplates(configResponse.data.templates);
            setTasks(taskResponse.data.items);
        } catch (error) {
            const text = error instanceof Error ? error.message : "Smart clip is unavailable";
            if (text.toLowerCase().includes("disabled") || text.toLowerCase().includes("requires")) setDisabledMessage(text);
            else message.error(text);
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        void load();
    }, [load]);

    const currentTemplate = useMemo(() => templates.find((item) => item.clipType === clipType), [clipType, templates]);
    const styleOptions = useMemo(() => templates.filter((item) => item.clipType === clipType).map((item) => ({ value: item.id, label: item.name })), [clipType, templates]);

    useEffect(() => {
        if (!styleId && currentTemplate) setStyleId(currentTemplate.id);
        if (currentTemplate && durationSeconds === 60) setDurationSeconds(currentTemplate.defaultDurationSeconds);
        if (currentTemplate) setRatio(currentTemplate.defaultRatio);
    }, [currentTemplate, durationSeconds, styleId]);

    const createTask = async () => {
        const materialItems = materials
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean)
            .map((url) => ({ type: "video", url }));
        if (!title.trim() || (!videoUri.trim() && !audioUri.trim() && materialItems.length === 0)) {
            message.warning("Enter a title and at least one source.");
            return;
        }
        setSaving(true);
        try {
            const body = { clipType, styleId, title, videoUri, audioUri, materials: materialItems, ratio, durationSeconds, quantity };
            const estimateResponse = await request<ApiEnvelope<{ estimate: { userChargePoints: number } }>>("/api/smart-clip/estimate", {
                method: "POST",
                body: JSON.stringify(body),
            });
            setEstimate(estimateResponse.data.estimate.userChargePoints);
            await request<ApiEnvelope<{ task: Task }>>("/api/smart-clip/tasks", {
                method: "POST",
                body: JSON.stringify(body),
            });
            message.success("Task created.");
            setTitle("");
            setVideoUri("");
            setAudioUri("");
            setMaterials("");
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "Failed to create task");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="flex h-full min-h-0 items-center justify-center bg-[#fafbfc] dark:bg-[#111316]">
                <Spin indicator={<LoaderCircle className="size-5 animate-spin" />} />
            </main>
        );
    }

    if (disabledMessage) {
        return (
            <main className="flex h-full min-h-0 items-center justify-center bg-[#fafbfc] px-6 dark:bg-[#111316]">
                <section className="max-w-md border border-dashed border-[#d9dee5] bg-white p-8 text-center dark:border-[#3a414b] dark:bg-[#181b20]">
                    <Clapperboard className="mx-auto size-10 text-sky-500" />
                    <h1 className="mt-4 text-xl font-semibold">Smart clip is disabled</h1>
                    <p className="mt-2 text-sm leading-6 text-[#68717d] dark:text-[#9da6b2]">{disabledMessage}</p>
                </section>
            </main>
        );
    }

    return (
        <main className="h-full min-h-0 overflow-y-auto bg-[#fafbfc] px-4 py-5 text-[#20242a] dark:bg-[#111316] dark:text-[#f3f5f7] sm:px-7 sm:py-7">
            <div className="mx-auto max-w-[1440px]">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e5e8ec] pb-5 dark:border-[#2e343c]">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-300">
                            <Clapperboard className="size-4" /> Professional tools
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Smart clip</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717d] dark:text-[#9da6b2]">Build a task from a source video, audio track, or material list.</p>
                    </div>
                    <Button icon={<RefreshCw className="size-4" />} onClick={() => void load()}>
                        Refresh
                    </Button>
                </header>

                <div className="grid gap-5 py-5 xl:grid-cols-[1fr_1.15fr]">
                    <section className="border border-[#e5e8ec] bg-white p-5 dark:border-[#2e343c] dark:bg-[#181b20]">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="size-4 text-amber-500" /> Create task
                        </div>
                        <div className="mt-4 grid gap-3">
                            <Segmented block value={clipType} options={clipTypeOptions} onChange={(value) => setClipType(value as ClipType)} />
                            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" maxLength={120} />
                            <Select value={styleId || undefined} onChange={setStyleId} options={styleOptions} placeholder="Template" />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Input value={videoUri} onChange={(event) => setVideoUri(event.target.value)} placeholder="Source video URL" />
                                <Input value={audioUri} onChange={(event) => setAudioUri(event.target.value)} placeholder="Source audio URL" />
                            </div>
                            <Input.TextArea value={materials} onChange={(event) => setMaterials(event.target.value)} placeholder="Material URLs, one per line" autoSize={{ minRows: 4, maxRows: 8 }} />
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Select
                                    value={ratio}
                                    onChange={setRatio}
                                    options={[
                                        { value: "duration", label: "Original ratio" },
                                        { value: "16:9", label: "16:9" },
                                        { value: "9:16", label: "9:16" },
                                        { value: "1:1", label: "1:1" },
                                    ]}
                                />
                                <Input type="number" min={1} max={3600} value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value) || 0)} placeholder="Duration" />
                                <Input type="number" min={1} max={20} value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} placeholder="Quantity" />
                            </div>
                            <div className="flex items-center justify-between gap-3 text-xs text-[#818a96]">
                                <span>{currentTemplate?.description || "Select a template."}</span>
                                <span>Last estimate: {estimate.toFixed(2)} points</span>
                            </div>
                            <Button type="primary" icon={<Clapperboard className="size-4" />} loading={saving} onClick={() => void createTask()}>
                                Create task
                            </Button>
                        </div>
                    </section>

                    <section className="border border-[#e5e8ec] bg-white p-5 dark:border-[#2e343c] dark:bg-[#181b20]">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">Task history</h2>
                                <p className="mt-1 text-sm text-[#68717d] dark:text-[#9da6b2]">Provider jobs and their current state.</p>
                            </div>
                            <span className="text-sm text-[#818a96]">{tasks.length} tasks</span>
                        </div>
                        <div className="mt-4 grid gap-3">
                            {tasks.length ? (
                                tasks.map((task) => (
                                    <article key={task.id} className="flex flex-wrap items-center justify-between gap-4 border border-[#e5e8ec] bg-white px-4 py-3 dark:border-[#2e343c] dark:bg-[#181b20]">
                                        <div className="min-w-0">
                                            <h3 className="truncate text-sm font-semibold">{task.title}</h3>
                                            <p className="mt-1 text-xs text-[#818a96]">
                                                {clipTypeOptions.find((item) => item.value === task.clipType)?.label || task.clipType} · {task.durationSeconds}s · {task.quantity} output
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-3 text-xs text-[#818a96]">
                                            <span>{task.provider}</span>
                                            <span>{task.progress}%</span>
                                            <span>{task.status}</span>
                                        </div>
                                    </article>
                                ))
                            ) : (
                                <div className="border border-dashed border-[#d9dee5] px-5 py-10 text-center text-sm text-[#818a96] dark:border-[#3a414b]">No smart clip tasks yet.</div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

async function request<T>(url: string, init?: RequestInit) {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
    const body = (await response.json()) as T & { msg?: string };
    if (!response.ok) throw new Error(body.msg || `Request failed (${response.status})`);
    return body;
}
