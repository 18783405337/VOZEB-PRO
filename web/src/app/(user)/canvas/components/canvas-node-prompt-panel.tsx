"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Square } from "lucide-react";
import { Button } from "antd";

import { ModelPicker } from "@/components/model-picker";
import { CreditSymbol, formatCreditAmount, requestCreditCost } from "@/constant/credits";
import { defaultConfig, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { canvasThemes } from "@/lib/canvas-theme";
import { imagePreviewUrl } from "@/lib/media-image-url";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasImageSettingsPopover } from "./canvas-image-settings-popover";
import { CanvasPromptLibrary } from "./canvas-prompt-library";
import { CanvasAudioSettingsPopover } from "./canvas-audio-settings-popover";
import { CanvasResourceMentionTextarea } from "./canvas-resource-mention-textarea";
import { CanvasVideoSettingsPopover } from "./canvas-video-settings-popover";
import { CanvasCameraControl } from "./canvas-camera-control";
import { CanvasNodeType, isCanvasImageNodeType, type CanvasGenerationMode, type CanvasNodeData } from "../types";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";
import { buildCanvasNodeConfig, canvasAudioConfigPatch, canvasVideoConfigPatch } from "../utils/canvas-node-config";
import { PANORAMA_IMAGE_SIZE } from "../utils/canvas-panorama";

export type CanvasNodeGenerationMode = CanvasGenerationMode;

type CanvasNodePromptPanelProps = {
    node: CanvasNodeData;
    isRunning: boolean;
    onPromptChange: (nodeId: string, prompt: string) => void;
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeData["metadata"]>) => void;
    onGenerate: (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => void;
    onStop: (nodeId: string) => void;
    mentionReferences?: CanvasResourceReference[];
    onImageSettingsOpenChange?: (open: boolean) => void;
};

export function CanvasNodePromptPanel({ node, isRunning, onPromptChange, onConfigChange, onGenerate, onStop, mentionReferences = [], onImageSettingsOpenChange }: CanvasNodePromptPanelProps) {
    const globalConfig = useEffectiveConfig();
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const mode = defaultMode(node.type);
    const config = buildNodeConfig(globalConfig, node, mode);
    const hasTextContent = node.type === CanvasNodeType.Text && Boolean(node.metadata?.content?.trim());
    const hasImageContent = isCanvasImageNodeType(node.type) && Boolean(node.metadata?.content);
    const isPanorama = node.type === CanvasNodeType.Panorama;
    const isEditingExistingContent = hasTextContent || hasImageContent;
    const [prompt, setPrompt] = useState(isEditingExistingContent ? "" : node.metadata?.prompt || "");
    const promptRef = useRef<HTMLTextAreaElement>(null);
    const connectedImages = mode === "video" ? mentionReferences.filter((reference) => reference.active && reference.kind === "image") : [];
    const credits = requestCreditCost({
        apiSource: config.apiSource,
        modelPointCosts: config.modelPointCosts,
        generationPointMultipliers: config.generationPointMultipliers,
        kind: mode,
        model: config.model,
        count: mode === "image" ? config.count : 1,
        quality: config.quality,
        videoQuality: config.vquality,
        videoSeconds: config.videoSeconds,
    });

    useEffect(() => {
        setPrompt(isEditingExistingContent ? "" : node.metadata?.prompt || "");
    }, [isEditingExistingContent, node.id]);

    const updatePrompt = (value: string) => {
        setPrompt(value);
        if (!isEditingExistingContent) onPromptChange(node.id, value);
    };

    const submit = () => {
        const text = prompt.trim();
        if (!text || isRunning) return;
        onGenerate(node.id, mode, text);
        setPrompt("");
    };

    const insertImageMention = (label: string) => {
        const textarea = promptRef.current;
        const start = textarea?.selectionStart ?? prompt.length;
        const end = textarea?.selectionEnd ?? start;
        const mention = `@${label}`;
        const needsLeadingSpace = start > 0 && /[\w@]$/u.test(prompt.slice(0, start));
        const needsTrailingSpace = end < prompt.length && /^\S/u.test(prompt.slice(end));
        const insert = `${needsLeadingSpace ? " " : ""}${mention}${needsTrailingSpace ? " " : ""}`;
        const next = `${prompt.slice(0, start)}${insert}${prompt.slice(end)}`;
        updatePrompt(next);
        requestAnimationFrame(() => {
            const cursor = start + insert.length;
            textarea?.focus();
            textarea?.setSelectionRange(cursor, cursor);
        });
    };

    return (
        <div
            className="rounded-2xl border p-3 shadow-2xl backdrop-blur"
            style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <CanvasResourceMentionTextarea
                ref={promptRef}
                value={prompt}
                references={mentionReferences}
                onChange={updatePrompt}
                onSubmit={submit}
                className="thin-scrollbar h-24 w-full resize-none rounded-xl border px-3 py-2 text-sm leading-5 outline-none"
                style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}
                placeholder={promptPlaceholder(mode, hasImageContent, hasTextContent, isPanorama)}
            />

            {connectedImages.length ? (
                <div className="mt-2 border-t pt-2" style={{ borderColor: theme.toolbar.border }}>
                    <div className="mb-1.5 text-[11px] font-medium opacity-65">已连接图片 · 点击插入引用</div>
                    <div className="thin-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
                        {connectedImages.map((reference) => (
                            <button
                                key={reference.id}
                                type="button"
                                className="flex w-32 shrink-0 items-center gap-2 rounded-lg border p-1.5 text-left transition hover:border-[#2f80ff]"
                                style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}
                                title={`插入 @${reference.label}`}
                                onClick={() => insertImageMention(reference.label)}
                            >
                                {reference.previewUrl ? <img src={imagePreviewUrl(reference.previewUrl, 96)} alt="" className="size-10 shrink-0 rounded-md object-cover" /> : <span className="size-10 shrink-0 rounded-md bg-black/10" />}
                                <span className="min-w-0">
                                    <span className="block text-xs font-semibold text-[#2f80ff]">@{reference.label}</span>
                                    <span className="block truncate text-[11px] opacity-60">{reference.title}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                <div className="canvas-composer-tools flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <CanvasPromptLibrary onSelect={updatePrompt} />
                    {mode === "image" ? (
                        <>
                            <ModelPicker className="min-w-[9rem] flex-1" config={config} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} capability="image" onMissingConfig={() => openConfigDialog(true)} />
                            <CanvasImageSettingsPopover
                                config={config}
                                placement="topLeft"
                                buttonClassName="canvas-composer-settings !h-10 !min-w-[9rem] !max-w-full !flex-1 !justify-start !rounded-full !px-3"
                                onConfigChange={(key, value) => onConfigChange(node.id, key === "count" ? { count: Number(value) || 1 } : { [key]: value })}
                                onOpenChange={onImageSettingsOpenChange}
                                fixedSizeLabel={isPanorama ? "全景 2:1" : undefined}
                            />
                            {!isPanorama ? (
                                <CanvasCameraControl
                                    value={node.metadata?.cameraControl}
                                    onChange={(cameraControl) => onConfigChange(node.id, { cameraControl })}
                                    buttonClassName="canvas-composer-settings !h-10 !min-w-[9rem] !max-w-full !flex-1 !justify-start !rounded-full !px-3"
                                />
                            ) : null}
                        </>
                    ) : mode === "video" ? (
                        <>
                            <ModelPicker className="min-w-[9rem] flex-1" config={config} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} capability="video" onMissingConfig={() => openConfigDialog(true)} />
                            <CanvasVideoSettingsPopover
                                config={config}
                                buttonClassName="canvas-composer-settings !h-10 !min-w-[9rem] !max-w-full !flex-1 !justify-start !rounded-full !px-3"
                                onConfigChange={(key, value) => onConfigChange(node.id, canvasVideoConfigPatch(key, value))}
                            />
                            <CanvasCameraControl
                                value={node.metadata?.cameraControl}
                                onChange={(cameraControl) => onConfigChange(node.id, { cameraControl })}
                                buttonClassName="canvas-composer-settings !h-10 !min-w-[9rem] !max-w-full !flex-1 !justify-start !rounded-full !px-3"
                            />
                        </>
                    ) : mode === "audio" ? (
                        <>
                            <ModelPicker className="min-w-[9rem] flex-1" config={config} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} capability="audio" onMissingConfig={() => openConfigDialog(true)} />
                            <CanvasAudioSettingsPopover
                                config={config}
                                buttonClassName="canvas-composer-settings !h-10 !min-w-[9rem] !max-w-full !flex-1 !justify-start !rounded-full !px-3"
                                onConfigChange={(key, value) => onConfigChange(node.id, canvasAudioConfigPatch(key, value))}
                            />
                        </>
                    ) : (
                        <ModelPicker className="min-w-[9rem] flex-1" config={config} value={config.model} onChange={(model) => onConfigChange(node.id, { model })} capability="text" onMissingConfig={() => openConfigDialog(true)} />
                    )}
                </div>
                <Button
                    type="primary"
                    className="canvas-generate-button !h-10 !min-w-16 shrink-0 !rounded-full !px-3"
                    danger={isRunning}
                    disabled={!isRunning && !prompt.trim()}
                    onClick={() => (isRunning ? onStop(node.id) : submit())}
                    aria-label={isRunning ? "停止生成" : "生成"}
                >
                    <span className="flex items-center gap-1.5">
                        {isRunning ? (
                            <>
                                <LoaderCircle className="size-4 animate-spin" />
                                <Square className="size-3.5 fill-current" />
                                <span className="text-xs font-medium">停止</span>
                            </>
                        ) : (
                            <>
                                <span className="text-xs font-semibold">生成</span>
                                <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                                    <CreditSymbol />
                                    {formatCreditAmount(credits)}
                                </span>
                            </>
                        )}
                    </span>
                </Button>
            </div>
        </div>
    );
}

function defaultMode(type: CanvasNodeData["type"]): CanvasNodeGenerationMode {
    return type === CanvasNodeType.Text ? "text" : type === CanvasNodeType.Video ? "video" : type === CanvasNodeType.Audio ? "audio" : "image";
}

function buildNodeConfig(globalConfig: AiConfig, node: CanvasNodeData, mode: CanvasNodeGenerationMode): AiConfig {
    const defaultModel = mode === "image" ? globalConfig.imageModel : mode === "video" ? globalConfig.videoModel : mode === "audio" ? globalConfig.audioModel : globalConfig.textModel;
    const model = node.metadata?.model || defaultModel || (mode === "audio" ? defaultConfig.audioModel : globalConfig.model || defaultConfig.model);
    const config = buildCanvasNodeConfig(globalConfig, node, mode, model);
    return node.type === CanvasNodeType.Panorama ? { ...config, size: PANORAMA_IMAGE_SIZE } : config;
}

function promptPlaceholder(mode: CanvasNodeGenerationMode, hasImageContent: boolean, hasTextContent: boolean, isPanorama: boolean) {
    if (mode === "video") return "描述要生成的视频内容";
    if (mode === "audio") return "描述要生成的音频内容";
    if (isPanorama) return hasImageContent ? "描述要如何调整这个全景环境" : "描述要生成的 360° 全景环境";
    if (mode === "image") return hasImageContent ? "请输入你想要把这张图修改成什么" : "描述要生成的图片内容";
    return hasTextContent ? "请输入你想要将本段文本修改成什么" : "请输入你想要生成的文本内容";
}
