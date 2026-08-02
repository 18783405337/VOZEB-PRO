"use client";

import { useRef } from "react";
import { App, Button, Input, Segmented, Tabs, Tag } from "antd";
import { ArrowLeft, BookOpenText, Clapperboard, Film, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { splitDramaSource } from "@/lib/drama-source-splitter";
import type { DramaEpisode, DramaProject } from "../types";
import { useDramaStore } from "../stores/use-drama-store";
import { SectionTitle } from "./drama-editor-elements";

export type DramaProjectStage = "script" | "review" | "assets" | "storyboard" | "generate";

const stages = [
    { value: "script", label: "剧本", shortLabel: "剧本", icon: Clapperboard },
    { value: "review", label: "内容审核", shortLabel: "审核", icon: Save },
    { value: "assets", label: "视觉资产", shortLabel: "资产", icon: Sparkles },
    { value: "storyboard", label: "分镜", shortLabel: "分镜", icon: Film },
    { value: "generate", label: "镜头生成", shortLabel: "生成", icon: Sparkles },
] as const;

export function DramaProjectHeader({ project, episode, stage, onStageChange, onOpenVersions }: { project: DramaProject; episode: DramaEpisode; stage: DramaProjectStage; onStageChange: (stage: DramaProjectStage) => void; onOpenVersions: () => void }) {
    const { modal } = App.useApp();
    const router = useRouter();
    const updateProject = useDramaStore((state) => state.updateProject);
    const addEpisode = useDramaStore((state) => state.addEpisode);
    const deleteEpisode = useDramaStore((state) => state.deleteEpisode);
    const selectEpisode = useDramaStore((state) => state.selectEpisode);

    return (
        <header className="overflow-hidden rounded-lg border border-border bg-card p-3 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-2.5 sm:gap-4">
                    <Button type="text" shape="circle" className="!size-9 sm:!size-9" icon={<ArrowLeft className="size-4" />} onClick={() => router.push("/drama")} aria-label="返回短剧项目" />
                    <div className="min-w-0">
                        <Input variant="borderless" className="!p-0 !text-xl !font-semibold sm:!text-2xl" value={project.title} onChange={(event) => updateProject(project.id, { title: event.target.value })} />
                        <p className="mt-1.5 text-sm leading-5 text-muted-foreground sm:mt-3 sm:leading-6">{project.summary || "完善剧本与角色后，再逐镜头生成视频。"}</p>
                    </div>
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
                    <Tag className="!m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={project.style}>
                        {project.style}
                    </Tag>
                    <Tag className="!m-0">{project.ratio}</Tag>
                    <Tag className="!m-0">{episode.shots.length} 个镜头</Tag>
                    <Button className="!h-9" icon={<Save className="size-4" />} onClick={onOpenVersions}>
                        版本
                    </Button>
                </div>
            </div>
            <Tabs
                className="mt-2.5 sm:mt-6"
                type="editable-card"
                activeKey={episode.id}
                items={project.episodes.map((item) => ({ key: item.id, label: item.title, closable: project.episodes.length > 1 }))}
                onChange={(episodeId) => selectEpisode(project.id, episodeId)}
                onEdit={(targetKey, action) => {
                    if (action === "add") {
                        addEpisode(project.id);
                        onStageChange("script");
                        return;
                    }
                    const removing = project.episodes.find((item) => item.id === String(targetKey));
                    if (!removing) return;
                    modal.confirm({
                        title: `删除${removing.title}？`,
                        content: "本集剧本、分镜和任务记录会一起删除。",
                        okText: "删除",
                        okButtonProps: { danger: true },
                        cancelText: "取消",
                        onOk: () => deleteEpisode(project.id, removing.id),
                    });
                }}
            />
            <div className="mt-3 grid grid-cols-5 gap-1.5 sm:mt-6 sm:gap-3">
                {stages.map((item, index) => {
                    const Icon = item.icon;
                    const active = stage === item.value;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => onStageChange(item.value)}
                            aria-label={`${String(index + 1).padStart(2, "0")} ${item.label}`}
                            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center transition sm:min-h-12 sm:flex-row sm:gap-3 sm:px-4 sm:py-3.5 sm:text-left ${active ? "border-foreground bg-foreground !text-background" : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:bg-accent hover:text-foreground"}`}
                        >
                            <span className="hidden text-xs opacity-60 sm:inline">0{index + 1}</span>
                            <Icon className="size-4" />
                            <span className="whitespace-nowrap text-[11px] font-medium leading-none sm:text-sm">
                                <span className="sm:hidden">{item.shortLabel}</span>
                                <span className="hidden sm:inline">{item.label}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </header>
    );
}

export function DramaScriptPanel({ project, episode, analyzing, onAnalyze, onStageChange }: { project: DramaProject; episode: DramaEpisode; analyzing: boolean; onAnalyze: () => void; onStageChange: (stage: DramaProjectStage) => void }) {
    const { message, modal } = App.useApp();
    const updateProject = useDramaStore((state) => state.updateProject);
    const updateEpisode = useDramaStore((state) => state.updateEpisode);
    const importEpisodes = useDramaStore((state) => state.importEpisodes);
    const createVersion = useDramaStore((state) => state.createVersion);
    const sourceFileInputRef = useRef<HTMLInputElement>(null);

    const importSourceBook = async (file?: File) => {
        if (!file) return;
        try {
            const drafts = splitDramaSource(await file.text());
            if (!drafts.length) return message.warning("导入文件没有可识别的文本内容");
            modal.confirm({
                title: `导入并自动分为 ${drafts.length} 集？`,
                content: "当前剧集会被替换，系统会先保存一个可恢复的版本快照。",
                okText: "导入分集",
                cancelText: "取消",
                onOk: async () => {
                    await createVersion(project, "整本导入前");
                    importEpisodes(project.id, drafts);
                    onStageChange("script");
                    message.success(`已导入 ${drafts.length} 集，请逐集检查并提取内容结构`);
                },
            });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "整本导入失败");
        } finally {
            if (sourceFileInputRef.current) sourceFileInputRef.current.value = "";
        }
    };

    return (
        <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                <SectionTitle className="!mb-0" title="剧本与创作方向" description="先整理故事文本，AI 只提取可审核的内容结构，不会在这一步生成视觉提示词。" />
                <Button className="!h-9 !w-full sm:!w-auto" icon={<BookOpenText className="size-4" />} onClick={() => sourceFileInputRef.current?.click()}>
                    导入整本并分集
                </Button>
            </div>
            <input ref={sourceFileInputRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(event) => void importSourceBook(event.target.files?.[0])} />
            <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Input.TextArea
                    className="!h-52 !rounded-lg !bg-background !p-2.5 sm:!h-auto sm:!p-4"
                    value={episode.script}
                    onChange={(event) => updateEpisode(project.id, episode.id, { script: event.target.value })}
                    rows={18}
                    placeholder="粘贴或编写本集剧本，每个段落会生成一个镜头草稿…"
                />
                <div className="space-y-4 rounded-lg border border-border bg-background p-3 sm:space-y-5 sm:p-5">
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">本集名称</span>
                        <Input value={episode.title} onChange={(event) => updateEpisode(project.id, episode.id, { title: event.target.value })} />
                    </label>
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">故事简介</span>
                        <Input.TextArea value={project.summary} onChange={(event) => updateProject(project.id, { summary: event.target.value })} rows={4} />
                    </label>
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">视觉风格</span>
                        <Input value={project.style} onChange={(event) => updateProject(project.id, { style: event.target.value })} />
                    </label>
                    <label className="block space-y-2.5">
                        <span className="text-sm font-medium">视频生产模式</span>
                        <Segmented
                            block
                            value={project.defaultVideoMode}
                            options={[
                                { label: "分镜驱动", value: "storyboard" },
                                { label: "直接生成", value: "direct" },
                                { label: "参考图", value: "reference" },
                            ]}
                            onChange={(value) => updateProject(project.id, { defaultVideoMode: value as DramaProject["defaultVideoMode"] })}
                        />
                    </label>
                    <Button type="primary" block className="!h-11 sm:!h-9" icon={<Sparkles className="size-4" />} loading={analyzing} onClick={onAnalyze}>
                        AI 提取内容结构
                    </Button>
                    <p className="pt-1 text-xs leading-5 text-muted-foreground">解析结果会进入内容审核，不会直接启动图片或视频生成。</p>
                </div>
            </div>
        </div>
    );
}
