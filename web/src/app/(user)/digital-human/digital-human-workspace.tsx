"use client";

import { App, Button, Input, Select, Spin, Upload } from "antd";
import type { UploadFile } from "antd";
import { FileAudio, ImagePlus, LoaderCircle, Mic2, RefreshCw, ScanFace, Sparkles, Video } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Avatar = {
    id: string;
    name: string;
    gender: string;
    scene: string;
    coverUri: string;
    mediaUri: string;
    mediaType: string;
    source: "official" | "mine";
    status: string;
};

type Voice = {
    id: string;
    name: string;
    gender: string;
    ageGroup: string;
    coverUri: string;
    audioUri: string;
    previewAudioUri: string;
    durationSeconds: number;
    source: "official" | "mine";
    status: string;
};

type Task = {
    id: string;
    avatarId: string;
    voiceId: string;
    title: string;
    scriptText: string;
    ratio: string;
    status: string;
    progress: number;
    providerStage: string;
    error: string;
    createdAt: string;
};

type ApiEnvelope<T> = { code: number; data: T; msg: string };

export function DigitalHumanWorkspace() {
    const { message } = App.useApp();
    const [avatars, setAvatars] = useState<Avatar[]>([]);
    const [voices, setVoices] = useState<Voice[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [disabledMessage, setDisabledMessage] = useState("");
    const [avatarName, setAvatarName] = useState("");
    const [avatarFile, setAvatarFile] = useState<UploadFile>();
    const [voiceName, setVoiceName] = useState("");
    const [voiceFile, setVoiceFile] = useState<UploadFile>();
    const [title, setTitle] = useState("");
    const [scriptText, setScriptText] = useState("");
    const [avatarId, setAvatarId] = useState("");
    const [voiceId, setVoiceId] = useState("");
    const [ratio, setRatio] = useState("16:9");
    const [saving, setSaving] = useState<"avatar" | "voice" | "task" | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setDisabledMessage("");
        try {
            const [avatarResponse, voiceResponse, taskResponse] = await Promise.all([
                request<ApiEnvelope<{ items: Avatar[] }>>("/api/digital-human/avatars"),
                request<ApiEnvelope<{ items: Voice[] }>>("/api/digital-human/voices"),
                request<ApiEnvelope<{ items: Task[] }>>("/api/digital-human/tasks"),
            ]);
            setAvatars(avatarResponse.data.items);
            setVoices(voiceResponse.data.items);
            setTasks(taskResponse.data.items);
            setAvatarId((current) => current || avatarResponse.data.items[0]?.id || "");
            setVoiceId((current) => current || voiceResponse.data.items[0]?.id || "");
        } catch (error) {
            const text = error instanceof Error ? error.message : "数字人模块暂时不可用";
            if (text.includes("未启用") || text.includes("需要启用")) setDisabledMessage(text);
            else message.error(text);
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        void load();
    }, [load]);

    const avatarOptions = useMemo(() => avatars.map((item) => ({ value: item.id, label: item.name })), [avatars]);
    const voiceOptions = useMemo(() => voices.map((item) => ({ value: item.id, label: item.name })), [voices]);

    const saveAsset = async (kind: "avatar" | "voice") => {
        const file = kind === "avatar" ? avatarFile : voiceFile;
        const name = (kind === "avatar" ? avatarName : voiceName).trim();
        if (!file?.originFileObj || !name) {
            message.warning(kind === "avatar" ? "请填写形象名称并选择图片" : "请填写音色名称并选择音频");
            return;
        }
        setSaving(kind);
        try {
            const type = kind === "avatar" ? "image" : "audio";
            const uploaded = await uploadFile(file.originFileObj, type);
            const response = await request<ApiEnvelope<{ avatar?: Avatar; voice?: Voice }>>(`/api/digital-human/${kind === "avatar" ? "avatars" : "voices"}`, {
                method: "POST",
                body: JSON.stringify(kind === "avatar" ? { name, mediaUri: uploaded.url, coverUri: uploaded.url, mediaType: file.originFileObj.type || "image" } : { name, audioUri: uploaded.url, previewAudioUri: uploaded.url }),
            });
            message.success(kind === "avatar" ? "数字人形象已保存" : "数字人音色已保存");
            if (kind === "avatar" && response.data.avatar) {
                setAvatars((items) => [response.data.avatar!, ...items]);
                setAvatarName("");
                setAvatarFile(undefined);
                setAvatarId(response.data.avatar.id);
            }
            if (kind === "voice" && response.data.voice) {
                setVoices((items) => [response.data.voice!, ...items]);
                setVoiceName("");
                setVoiceFile(undefined);
                setVoiceId(response.data.voice.id);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : "素材保存失败");
        } finally {
            setSaving(null);
        }
    };

    const createTask = async () => {
        if (!avatarId || !voiceId || !title.trim() || !scriptText.trim()) {
            message.warning("请选择形象、音色并填写任务标题和文案");
            return;
        }
        setSaving("task");
        try {
            await request<ApiEnvelope<{ task: Task }>>("/api/digital-human/tasks", {
                method: "POST",
                body: JSON.stringify({ avatarId, voiceId, title, scriptText, ratio }),
            });
            message.success("任务已创建，当前等待供应商适配器");
            setTitle("");
            setScriptText("");
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "任务创建失败");
        } finally {
            setSaving(null);
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
                    <ScanFace className="mx-auto size-10 text-violet-500" />
                    <h1 className="mt-4 text-xl font-semibold">数字人模块未启用</h1>
                    <p className="mt-2 text-sm leading-6 text-[#68717d] dark:text-[#9da6b2]">{disabledMessage}</p>
                    <p className="mt-4 text-xs text-[#8d96a2]">启用后刷新此页面即可进入形象、音色和任务管理。</p>
                </section>
            </main>
        );
    }

    return (
        <main className="h-full min-h-0 overflow-y-auto bg-[#fafbfc] px-4 py-5 text-[#20242a] dark:bg-[#111316] dark:text-[#f3f5f7] sm:px-7 sm:py-7">
            <div className="mx-auto max-w-[1440px]">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e5e8ec] pb-5 dark:border-[#2e343c]">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-300">
                            <ScanFace className="size-4" /> 专业工具
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">数字人</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717d] dark:text-[#9da6b2]">管理可复用的数字人形象与音色，创建后续由供应商执行的视频任务。</p>
                    </div>
                    <Button icon={<RefreshCw className="size-4" />} onClick={() => void load()}>
                        刷新
                    </Button>
                </header>

                <div className="grid gap-5 py-5 xl:grid-cols-[1fr_1fr_1.2fr]">
                    <AssetPanel
                        title="数字人形象"
                        icon={<ImagePlus className="size-4" />}
                        name={avatarName}
                        file={avatarFile}
                        accept="image/*"
                        busy={saving === "avatar"}
                        items={avatars}
                        onNameChange={setAvatarName}
                        onFileChange={setAvatarFile}
                        onSave={() => void saveAsset("avatar")}
                        renderItem={(item) => (
                            <div className="flex items-center gap-3">
                                {item.coverUri ? <img src={item.coverUri} alt="" className="size-11 rounded-md object-cover" /> : <div className="size-11 rounded-md bg-violet-100 dark:bg-violet-950/40" />}
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{item.name}</div>
                                    <div className="mt-1 text-xs text-[#818a96]">{item.source === "official" ? "官方素材" : "我的素材"}</div>
                                </div>
                            </div>
                        )}
                    />
                    <AssetPanel
                        title="数字人音色"
                        icon={<Mic2 className="size-4" />}
                        name={voiceName}
                        file={voiceFile}
                        accept="audio/*"
                        busy={saving === "voice"}
                        items={voices}
                        onNameChange={setVoiceName}
                        onFileChange={setVoiceFile}
                        onSave={() => void saveAsset("voice")}
                        renderItem={(item) => (
                            <div className="flex items-center gap-3">
                                <div className="flex size-11 items-center justify-center rounded-md bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
                                    <FileAudio className="size-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{item.name}</div>
                                    <div className="mt-1 text-xs text-[#818a96]">{item.durationSeconds ? `${item.durationSeconds}s` : "自定义音频"}</div>
                                </div>
                            </div>
                        )}
                    />
                    <section className="border border-[#e5e8ec] bg-white p-5 dark:border-[#2e343c] dark:bg-[#181b20]">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="size-4 text-amber-500" /> 创建视频任务
                        </div>
                        <div className="mt-4 grid gap-3">
                            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="任务标题" maxLength={120} />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Select value={avatarId || undefined} onChange={setAvatarId} options={avatarOptions} placeholder="选择数字人形象" showSearch optionFilterProp="label" />
                                <Select value={voiceId || undefined} onChange={setVoiceId} options={voiceOptions} placeholder="选择音色" showSearch optionFilterProp="label" />
                            </div>
                            <Select
                                value={ratio}
                                onChange={setRatio}
                                options={[
                                    { value: "16:9", label: "横屏 16:9" },
                                    { value: "9:16", label: "竖屏 9:16" },
                                    { value: "1:1", label: "方形 1:1" },
                                ]}
                            />
                            <Input.TextArea value={scriptText} onChange={(event) => setScriptText(event.target.value)} placeholder="输入数字人需要表达的文案" autoSize={{ minRows: 6, maxRows: 12 }} maxLength={10_000} showCount />
                            <Button type="primary" icon={<Video className="size-4" />} loading={saving === "task"} onClick={() => void createTask()}>
                                创建任务
                            </Button>
                        </div>
                    </section>
                </div>

                <section className="border-t border-[#e5e8ec] pt-5 dark:border-[#2e343c]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">任务记录</h2>
                            <p className="mt-1 text-sm text-[#68717d] dark:text-[#9da6b2]">当前展示任务状态和供应商阶段，真实视频生成将在适配器接入后执行。</p>
                        </div>
                        <span className="text-sm text-[#818a96]">{tasks.length} 条</span>
                    </div>
                    <div className="mt-4 grid gap-3">
                        {tasks.length ? (
                            tasks.map((task) => (
                                <article key={task.id} className="flex flex-wrap items-center justify-between gap-4 border border-[#e5e8ec] bg-white px-4 py-3 dark:border-[#2e343c] dark:bg-[#181b20]">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-semibold">{task.title}</h3>
                                        <p className="mt-1 line-clamp-2 text-sm text-[#68717d] dark:text-[#9da6b2]">{task.scriptText}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3 text-xs text-[#818a96]">
                                        <span>{task.ratio}</span>
                                        <span>{task.providerStage || "等待供应商"}</span>
                                        <span>{task.status}</span>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <div className="border border-dashed border-[#d9dee5] px-5 py-10 text-center text-sm text-[#818a96] dark:border-[#3a414b]">还没有数字人任务</div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

function AssetPanel<T extends Avatar | Voice>({
    title,
    icon,
    name,
    file,
    accept,
    busy,
    items,
    onNameChange,
    onFileChange,
    onSave,
    renderItem,
}: {
    title: string;
    icon: ReactNode;
    name: string;
    file?: UploadFile;
    accept: string;
    busy: boolean;
    items: T[];
    onNameChange: (value: string) => void;
    onFileChange: (file?: UploadFile) => void;
    onSave: () => void;
    renderItem: (item: T) => ReactNode;
}) {
    return (
        <section className="border border-[#e5e8ec] bg-white p-5 dark:border-[#2e343c] dark:bg-[#181b20]">
            <div className="flex items-center gap-2 text-sm font-semibold">
                {icon} {title}
            </div>
            <div className="mt-4 grid gap-3">
                <Input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={`${title}名称`} maxLength={80} />
                <Upload
                    accept={accept}
                    maxCount={1}
                    beforeUpload={(file) => {
                        onFileChange({ uid: file.uid, name: file.name, originFileObj: file });
                        return false;
                    }}
                    onRemove={() => onFileChange(undefined)}
                    fileList={file ? [file] : []}
                >
                    <Button icon={<FileAudio className="size-4" />}>{file ? "重新选择素材" : "选择素材"}</Button>
                </Upload>
                <Button type="primary" loading={busy} onClick={onSave}>
                    保存素材
                </Button>
            </div>
            <div className="mt-5 grid gap-2">
                {items.length ? (
                    items.map((item) => (
                        <div key={item.id} className="border-t border-[#eef0f2] py-3 first:border-t-0 dark:border-[#2b3139]">
                            {renderItem(item)}
                        </div>
                    ))
                ) : (
                    <div className="py-5 text-center text-sm text-[#818a96]">暂无素材</div>
                )}
            </div>
        </section>
    );
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
