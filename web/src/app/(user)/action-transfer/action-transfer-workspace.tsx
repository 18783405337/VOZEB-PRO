"use client";

import { App, Button, Input, InputNumber, Progress, Segmented, Spin, Upload } from "antd";
import type { UploadFile } from "antd";
import {
    ArrowUpRight,
    Images,
    LoaderCircle,
    Play,
    RefreshCw,
    Sparkles,
    UploadCloud,
    Video,
    WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ActionTransferTask = {
    id: string;
    title: string;
    referenceImages: readonly string[];
    sourceVideo: string;
    prompt: string;
    mode: "fast" | "standard" | "max";
    faceCount: number;
    durationSeconds: number;
    providerStage: string;
    status: string;
    progress: number;
    error: string;
    createdAt: string;
};

type ActionTransferResult = {
    id: string;
    taskId: string;
    title: string;
    coverUri: string;
    videoUri: string;
    durationSeconds: number;
    createdAt: string;
};

type ApiEnvelope<T> = { code: number; data: T; msg: string };
type UploadedAsset = { url: string; upstreamUrl?: string };

export function ActionTransferWorkspace() {
    const { message } = App.useApp();
    const [tasks, setTasks] = useState<ActionTransferTask[]>([]);
    const [results, setResults] = useState<ActionTransferResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [disabledMessage, setDisabledMessage] = useState("");
    const [title, setTitle] = useState("");
    const [prompt, setPrompt] = useState("");
    const [mode, setMode] = useState<"fast" | "standard" | "max">("standard");
    const [faceCount, setFaceCount] = useState(1);
    const [duration, setDuration] = useState(12);
    const [referenceFiles, setReferenceFiles] = useState<UploadFile[]>([]);
    const [videoFile, setVideoFile] = useState<UploadFile>();

    const load = useCallback(
        async (quiet = false) => {
            if (!quiet) setLoading(true);
            setDisabledMessage("");
            try {
                const [taskResponse, resultResponse] = await Promise.all([
                    request<ApiEnvelope<{ items: ActionTransferTask[] }>>("/api/action-transfer/tasks"),
                    request<ApiEnvelope<{ items: ActionTransferResult[] }>>("/api/action-transfer/results"),
                ]);
                setTasks(taskResponse.data.items);
                setResults(resultResponse.data.items);
            } catch (error) {
                const text = error instanceof Error ? error.message : "动作迁移模块暂时不可用";
                if (text.includes("未启用") || text.includes("需要启用") || text.includes("未订阅")) {
                    setDisabledMessage(text);
                } else if (!quiet) {
                    message.error(text);
                }
            } finally {
                if (!quiet) setLoading(false);
            }
        },
        [message],
    );

    useEffect(() => {
        void load();
    }, [load]);

    const hasActiveTask = useMemo(
        () => tasks.some((task) => task.status === "pending" || task.status === "running"),
        [tasks],
    );

    useEffect(() => {
        if (!hasActiveTask) return;
        const timer = window.setInterval(() => void load(true), 6_000);
        return () => window.clearInterval(timer);
    }, [hasActiveTask, load]);

    const createTask = async () => {
        const images = referenceFiles.flatMap((file) => (file.originFileObj ? [file.originFileObj] : []));
        const video = videoFile?.originFileObj;
        if (!images.length || !video) {
            message.warning("请上传人物参考图和动作视频");
            return;
        }
        const selectedVideo = video;

        setSaving(true);
        try {
            const [uploadedImages, uploadedVideo] = await Promise.all([
                Promise.all(images.map((file) => uploadFile(file, "image"))),
                uploadFile(selectedVideo, "video"),
            ]);
            await request<ApiEnvelope<{ task: ActionTransferTask }>>("/api/action-transfer/tasks", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    referenceImages: uploadedImages.map(providerAssetUrl),
                    sourceVideo: providerAssetUrl(uploadedVideo),
                    prompt,
                    mode,
                    faceCount,
                    duration,
                }),
            });
            message.success("动作迁移任务已创建");
            setTitle("");
            setPrompt("");
            setReferenceFiles([]);
            setVideoFile(undefined);
            await load(true);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "动作迁移任务创建失败");
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
                    <WandSparkles className="mx-auto size-10 text-cyan-600" />
                    <h1 className="mt-4 text-xl font-semibold">动作迁移未启用</h1>
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
                            <WandSparkles className="size-4" /> 专业工具
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">动作迁移</h1>
                        <p className="mt-2 text-sm leading-6 text-[#68717d] dark:text-[#9da6b2]">
                            以人物参考图固定主体，将源视频中的动作和节奏迁移到生成结果。
                        </p>
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
                            <Input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="任务标题（可选）"
                                maxLength={120}
                            />
                            <MultiImagePicker files={referenceFiles} onChange={setReferenceFiles} />
                            <SingleVideoPicker file={videoFile} onChange={setVideoFile} />
                            <Input.TextArea
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                placeholder="补充人物、镜头或动作要求（可选）"
                                autoSize={{ minRows: 4, maxRows: 8 }}
                                maxLength={2_000}
                                showCount
                            />
                            <Segmented
                                block
                                value={mode}
                                onChange={(value) => setMode(value as "fast" | "standard" | "max")}
                                options={[
                                    { label: "快速", value: "fast" },
                                    { label: "标准", value: "standard" },
                                    { label: "增强", value: "max" },
                                ]}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <InputNumber
                                    className="w-full"
                                    min={1}
                                    max={7}
                                    value={faceCount}
                                    addonBefore="人数"
                                    onChange={(value) => setFaceCount(value || 1)}
                                />
                                <InputNumber
                                    className="w-full"
                                    min={1}
                                    max={300}
                                    value={duration}
                                    addonBefore="时长"
                                    addonAfter="秒"
                                    onChange={(value) => setDuration(value || 1)}
                                />
                            </div>
                            <Button
                                type="primary"
                                icon={<Video className="size-4" />}
                                loading={saving}
                                onClick={() => void createTask()}
                            >
                                创建迁移视频
                            </Button>
                        </div>
                    </section>

                    <div className="min-w-0">
                        <TaskList tasks={tasks} />
                        <ResultList results={results} />
                    </div>
                </div>
            </div>
        </main>
    );
}

function MultiImagePicker({
    files,
    onChange,
}: {
    files: UploadFile[];
    onChange: (files: UploadFile[]) => void;
}) {
    return (
        <Upload.Dragger
            accept="image/*"
            multiple
            maxCount={3}
            beforeUpload={(file) => {
                onChange([...files, { uid: file.uid, name: file.name, originFileObj: file }].slice(0, 3));
                return false;
            }}
            onRemove={(file) => {
                onChange(files.filter((item) => item.uid !== file.uid));
                return true;
            }}
            fileList={files}
            className="overflow-hidden"
        >
            <div className="flex items-center justify-center gap-3 px-3 py-2">
                <Images className="size-5 text-cyan-700 dark:text-cyan-300" />
                <span className="text-sm">人物参考图，最多 3 张</span>
            </div>
        </Upload.Dragger>
    );
}

function SingleVideoPicker({
    file,
    onChange,
}: {
    file?: UploadFile;
    onChange: (file?: UploadFile) => void;
}) {
    return (
        <Upload.Dragger
            accept="video/*"
            maxCount={1}
            beforeUpload={(nextFile) => {
                onChange({ uid: nextFile.uid, name: nextFile.name, originFileObj: nextFile });
                return false;
            }}
            onRemove={() => {
                onChange(undefined);
                return true;
            }}
            fileList={file ? [file] : []}
            className="overflow-hidden"
        >
            <div className="flex items-center justify-center gap-3 px-3 py-2">
                {file ? (
                    <Video className="size-5 text-cyan-700 dark:text-cyan-300" />
                ) : (
                    <UploadCloud className="size-5 text-cyan-700 dark:text-cyan-300" />
                )}
                <span className="min-w-0 truncate text-sm">{file?.name || "上传动作视频"}</span>
            </div>
        </Upload.Dragger>
    );
}

function TaskList({ tasks }: { tasks: ActionTransferTask[] }) {
    return (
        <section>
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">任务记录</h2>
                <span className="text-sm text-[#818a96]">{tasks.length} 条</span>
            </div>
            <div className="mt-4 grid gap-3">
                {tasks.length ? (
                    tasks.map((task) => (
                        <article
                            key={task.id}
                            className="grid gap-4 border-b border-[#e5e8ec] py-4 first:pt-0 dark:border-[#2e343c] sm:grid-cols-[72px_minmax(0,1fr)_150px]"
                        >
                            <img
                                src={task.referenceImages[0]}
                                alt=""
                                className="aspect-square size-[72px] rounded-md bg-[#eef1f4] object-cover dark:bg-[#242a31]"
                            />
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="truncate text-sm font-semibold">{task.title || "动作迁移"}</h3>
                                    <span className="text-xs text-[#818a96]">{statusLabel(task.status)}</span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-sm text-[#68717d] dark:text-[#9da6b2]">
                                    {task.prompt || "按源视频迁移动作"}
                                </p>
                                <Progress
                                    className="mt-3 max-w-md"
                                    percent={task.progress}
                                    size="small"
                                    status={task.status === "error" ? "exception" : undefined}
                                />
                                {task.error ? <p className="mt-1 text-xs text-red-600">{task.error}</p> : null}
                            </div>
                            <div className="text-right text-xs leading-6 text-[#818a96]">
                                <div>{modeLabel(task.mode)}</div>
                                <div>
                                    {task.faceCount} 人 · {task.durationSeconds} 秒
                                </div>
                                <div>{task.providerStage || "等待调度"}</div>
                            </div>
                        </article>
                    ))
                ) : (
                    <div className="border border-dashed border-[#d9dee5] px-5 py-10 text-center text-sm text-[#818a96] dark:border-[#3a414b]">
                        还没有动作迁移任务
                    </div>
                )}
            </div>
        </section>
    );
}

function ResultList({ results }: { results: ActionTransferResult[] }) {
    return (
        <section className="mt-8 border-t border-[#e5e8ec] pt-6 dark:border-[#2e343c]">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">生成结果</h2>
                <span className="text-sm text-[#818a96]">{results.length} 条</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {results.length ? (
                    results.map((result) => (
                        <article
                            key={result.id}
                            className="overflow-hidden border border-[#e5e8ec] bg-white dark:border-[#2e343c] dark:bg-[#181b20]"
                        >
                            <video
                                className="aspect-video w-full bg-black object-contain"
                                controls
                                preload="metadata"
                                poster={result.coverUri}
                            >
                                <source src={result.videoUri} />
                            </video>
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                    <h3 className="truncate text-sm font-semibold">{result.title || "动作迁移"}</h3>
                                    <p className="mt-1 text-xs text-[#818a96]">{result.durationSeconds} 秒</p>
                                </div>
                                <Button
                                    type="text"
                                    icon={<ArrowUpRight className="size-4" />}
                                    href={result.videoUri}
                                    target="_blank"
                                    aria-label="打开视频"
                                />
                            </div>
                        </article>
                    ))
                ) : (
                    <div className="col-span-full border border-dashed border-[#d9dee5] px-5 py-10 text-center text-sm text-[#818a96] dark:border-[#3a414b]">
                        完成的任务会显示在这里
                    </div>
                )}
            </div>
        </section>
    );
}

function modeLabel(mode: ActionTransferTask["mode"]) {
    if (mode === "fast") return "快速模式";
    if (mode === "max") return "增强模式";
    return "标准模式";
}

function statusLabel(status: string) {
    if (status === "success") return "已完成";
    if (status === "error") return "失败";
    if (status === "running") return "生成中";
    if (status === "cancelled") return "已取消";
    return "等待中";
}

async function uploadFile(file: File, type: "image" | "video") {
    const dataUrl = await readFileAsDataUrl(file);
    return request<UploadedAsset>("/api/reference-assets", {
        method: "POST",
        body: JSON.stringify({ dataUrl, type, persistent: true, originalName: file.name }),
    });
}

function providerAssetUrl(asset: UploadedAsset) {
    return asset.upstreamUrl || asset.url;
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
    const response = await fetch(url, {
        ...init,
        headers: { "content-type": "application/json", ...(init?.headers || {}) },
    });
    const payload = (await response.json().catch(() => ({}))) as T & { msg?: string; error?: string };
    if (!response.ok) throw new Error(payload.msg || payload.error || `请求失败（${response.status}）`);
    return payload;
}
