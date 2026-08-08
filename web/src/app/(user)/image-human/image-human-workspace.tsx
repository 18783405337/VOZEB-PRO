"use client";

import { App, Button, Input, InputNumber, Progress, Segmented, Spin, Upload } from "antd";
import type { UploadFile } from "antd";
import { FileAudio, ImagePlus, LoaderCircle, Play, RefreshCw, ScanFace, Sparkles, UploadCloud, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ImageHumanTask = {
    id: string;
    title: string;
    sourceImageUri: string;
    referenceAudioUri: string;
    scriptText: string;
    prompt: string;
    mode: string;
    durationSeconds: number;
    providerStage: string;
    status: string;
    progress: number;
    error: string;
    createdAt: string;
};

type ImageHumanResult = {
    id: string;
    taskId: string;
    title: string;
    coverUri: string;
    videoUri: string;
    durationSeconds: number;
    createdAt: string;
};

type ApiEnvelope<T> = { code: number; data: T; msg: string };

export function ImageHumanWorkspace() {
    const { message } = App.useApp();
    const [tasks, setTasks] = useState<ImageHumanTask[]>([]);
    const [results, setResults] = useState<ImageHumanResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [disabledMessage, setDisabledMessage] = useState("");
    const [title, setTitle] = useState("");
    const [scriptText, setScriptText] = useState("");
    const [prompt, setPrompt] = useState("");
    const [duration, setDuration] = useState(10);
    const [mode, setMode] = useState<"standard" | "pro">("standard");
    const [imageFile, setImageFile] = useState<UploadFile>();
    const [audioFile, setAudioFile] = useState<UploadFile>();

    const load = useCallback(
        async (quiet = false) => {
            if (!quiet) setLoading(true);
            setDisabledMessage("");
            try {
                const [taskResponse, resultResponse] = await Promise.all([
                    request<ApiEnvelope<{ items: ImageHumanTask[] }>>("/api/image-human/tasks"),
                    request<ApiEnvelope<{ items: ImageHumanResult[] }>>("/api/image-human/results"),
                ]);
                setTasks(taskResponse.data.items);
                setResults(resultResponse.data.items);
            } catch (error) {
                const text = error instanceof Error ? error.message : "图片数字人模块暂时不可用";
                if (text.includes("未启用") || text.includes("需要启用") || text.includes("未订阅")) setDisabledMessage(text);
                else if (!quiet) message.error(text);
            } finally {
                if (!quiet) setLoading(false);
            }
        },
        [message],
    );

    useEffect(() => {
        void load();
    }, [load]);

    const hasActiveTask = useMemo(() => tasks.some((task) => task.status === "pending" || task.status === "running"), [tasks]);

    useEffect(() => {
        if (!hasActiveTask) return;
        const timer = window.setInterval(() => void load(true), 6_000);
        return () => window.clearInterval(timer);
    }, [hasActiveTask, load]);

    const createTask = async () => {
        if (!imageFile?.originFileObj || !audioFile?.originFileObj) {
            message.warning("请选择人物图片和驱动音频");
            return;
        }
        setSaving(true);
        try {
            const [image, audio] = await Promise.all([
                uploadFile(imageFile.originFileObj, "image"),
                uploadFile(audioFile.originFileObj, "audio"),
            ]);
            await request<ApiEnvelope<{ task: ImageHumanTask }>>("/api/image-human/tasks", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    imageUrl: image.url,
                    audioUrl: audio.url,
                    scriptText,
                    prompt,
                    duration,
                    mode,
                }),
            });
            message.success("图片数字人任务已创建");
            setTitle("");
            setScriptText("");
            setPrompt("");
            setImageFile(undefined);
            setAudioFile(undefined);
            await load(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "图片数字人任务创建失败");
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
                    <ScanFace className="mx-auto size-10 text-cyan-600" />
                    <h1 className="mt-4 text-xl font-semibold">图片数字人未启用</h1>
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
                        <div className="flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-300">
                            <ScanFace className="size-4" /> 专业工具
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">图片数字人</h1>
                        <p className="mt-2 text-sm leading-6 text-[#68717d] dark:text-[#9da6b2]">组合人物图片与驱动音频，生成可下载的视频结果。</p>
                    </div>
                    <Button icon={<RefreshCw className="size-4" />} onClick={() => void load()}>
                        刷新
                    </Button>
                </header>

                <div className="grid gap-6 py-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                    <section className="border-r border-[#e5e8ec] pr-0 dark:border-[#2e343c] xl:pr-6">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="size-4 text-amber-500" /> 创建任务
                        </div>
                        <div className="mt-4 grid gap-4">
                            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="任务标题（可选）" maxLength={120} />
                            <AssetPicker
                                title="人物图片"
                                accept="image/*"
                                file={imageFile}
                                icon={<ImagePlus className="size-5" />}
                                onChange={setImageFile}
                            />
                            <AssetPicker
                                title="驱动音频"
                                accept="audio/*"
                                file={audioFile}
                                icon={<FileAudio className="size-5" />}
                                onChange={setAudioFile}
                            />
                            <Input.TextArea
                                value={scriptText}
                                onChange={(event) => setScriptText(event.target.value)}
                                placeholder="口播文案（可选）"
                                autoSize={{ minRows: 4, maxRows: 8 }}
                                maxLength={10_000}
                                showCount
                            />
                            <Input.TextArea
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                placeholder="动作、表情或镜头提示（可选）"
                                autoSize={{ minRows: 3, maxRows: 6 }}
                                maxLength={4_000}
                            />
                            <div className="grid grid-cols-[1fr_140px] gap-3">
                                <Segmented
                                    block
                                    value={mode}
                                    onChange={(value) => setMode(value as "standard" | "pro")}
                                    options={[
                                        { label: "标准", value: "standard" },
                                        { label: "专业", value: "pro" },
                                    ]}
                                />
                                <InputNumber
                                    className="w-full"
                                    min={1}
                                    max={300}
                                    value={duration}
                                    addonAfter="秒"
                                    onChange={(value) => setDuration(value || 1)}
                                />
                            </div>
                            <Button type="primary" icon={<Video className="size-4" />} loading={saving} onClick={() => void createTask()}>
                                创建视频
                            </Button>
                        </div>
                    </section>

                    <div className="min-w-0">
                        <section>
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-semibold">任务记录</h2>
                                <span className="text-sm text-[#818a96]">{tasks.length} 条</span>
                            </div>
                            <div className="mt-4 grid gap-3">
                                {tasks.length ? (
                                    tasks.map((task) => (
                                        <article key={task.id} className="grid gap-4 border-b border-[#e5e8ec] py-4 first:pt-0 dark:border-[#2e343c] sm:grid-cols-[72px_minmax(0,1fr)_140px]">
                                            <img src={task.sourceImageUri} alt="" className="aspect-square size-[72px] rounded-md bg-[#eef1f4] object-cover dark:bg-[#242a31]" />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="truncate text-sm font-semibold">{task.title || "图片数字人"}</h3>
                                                    <span className="text-xs text-[#818a96]">{statusLabel(task.status)}</span>
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-sm text-[#68717d] dark:text-[#9da6b2]">{task.scriptText || task.prompt || "未填写文案"}</p>
                                                <Progress className="mt-3 max-w-md" percent={task.progress} size="small" status={task.status === "error" ? "exception" : undefined} />
                                                {task.error ? <p className="mt-1 text-xs text-red-600">{task.error}</p> : null}
                                            </div>
                                            <div className="text-right text-xs leading-6 text-[#818a96]">
                                                <div>{task.mode === "pro" ? "专业模式" : "标准模式"}</div>
                                                <div>{task.durationSeconds} 秒</div>
                                                <div>{task.providerStage || "等待调度"}</div>
                                            </div>
                                        </article>
                                    ))
                                ) : (
                                    <div className="border border-dashed border-[#d9dee5] px-5 py-10 text-center text-sm text-[#818a96] dark:border-[#3a414b]">还没有图片数字人任务</div>
                                )}
                            </div>
                        </section>

                        <section className="mt-8 border-t border-[#e5e8ec] pt-6 dark:border-[#2e343c]">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-semibold">生成结果</h2>
                                <span className="text-sm text-[#818a96]">{results.length} 条</span>
                            </div>
                            <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                {results.length ? (
                                    results.map((result) => (
                                        <article key={result.id} className="overflow-hidden border border-[#e5e8ec] bg-white dark:border-[#2e343c] dark:bg-[#181b20]">
                                            <video className="aspect-video w-full bg-black object-contain" controls preload="metadata" poster={result.coverUri}>
                                                <source src={result.videoUri} />
                                            </video>
                                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-sm font-semibold">{result.title || "图片数字人"}</h3>
                                                    <p className="mt-1 text-xs text-[#818a96]">{result.durationSeconds} 秒</p>
                                                </div>
                                                <Button
                                                    type="text"
                                                    icon={<Play className="size-4" />}
                                                    href={result.videoUri}
                                                    target="_blank"
                                                    aria-label="打开视频"
                                                />
                                            </div>
                                        </article>
                                    ))
                                ) : (
                                    <div className="col-span-full border border-dashed border-[#d9dee5] px-5 py-10 text-center text-sm text-[#818a96] dark:border-[#3a414b]">完成的任务会显示在这里</div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}

function AssetPicker({
    title,
    accept,
    file,
    icon,
    onChange,
}: {
    title: string;
    accept: string;
    file?: UploadFile;
    icon: React.ReactNode;
    onChange: (file?: UploadFile) => void;
}) {
    return (
        <Upload.Dragger
            accept={accept}
            maxCount={1}
            beforeUpload={(nextFile) => {
                onChange({ uid: nextFile.uid, name: nextFile.name, originFileObj: nextFile });
                return false;
            }}
            onRemove={() => onChange(undefined)}
            fileList={file ? [file] : []}
            className="overflow-hidden"
        >
            <div className="flex items-center justify-center gap-3 px-3 py-2">
                <span className="text-cyan-700 dark:text-cyan-300">{file ? icon : <UploadCloud className="size-5" />}</span>
                <span className="min-w-0 truncate text-sm">{file?.name || title}</span>
            </div>
        </Upload.Dragger>
    );
}

function statusLabel(status: string) {
    if (status === "success") return "已完成";
    if (status === "error") return "失败";
    if (status === "running") return "生成中";
    if (status === "cancelled") return "已取消";
    return "等待中";
}

async function uploadFile(file: File, type: "image" | "audio") {
    const dataUrl = await readFileAsDataUrl(file);
    return request<{ url: string }>("/api/reference-assets", {
        method: "POST",
        body: JSON.stringify({ dataUrl, type, persistent: true, originalName: file.name }),
    });
}

function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("素材读取失败"));
        reader.readAsDataURL(file);
    });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) } });
    const payload = (await response.json().catch(() => ({}))) as T & { msg?: string; error?: string };
    if (!response.ok) throw new Error(payload.msg || payload.error || `请求失败（${response.status}）`);
    return payload;
}
