import type { LogicalModelCapability, SpecializedProviderProtocol, SystemDefaultModels, SystemModelChannel } from "@/lib/auth/store";
import { channelDetectedCapabilities, normalizeDefaultModelsConfig } from "@/lib/model-routing-config";
import { channelProtocolDefinition } from "@/lib/channel-protocol-registry";

export type ChannelWorkspaceSettings = {
    systemChannels: SystemModelChannel[];
    logicalModels: import("@/lib/auth/store").LogicalModel[];
    defaultModels: SystemDefaultModels;
};

export type ChannelWorkspaceStatus = "enabled" | "draft" | "disabled";
export type ChannelWorkspaceKind = "general" | "digital-human" | "image-human" | "action-transfer";

const capabilityLabels: Record<LogicalModelCapability, string> = { text: "文本", image: "图片", video: "视频", audio: "音频" };

export function channelWorkspaceStatus(channel: SystemModelChannel): ChannelWorkspaceStatus {
    if (channel.enabled) return "enabled";
    return channel.baseUrl.trim() ? "disabled" : "draft";
}

export function channelWorkspaceStatusLabel(status: ChannelWorkspaceStatus) {
    return { enabled: "已启用", draft: "草稿", disabled: "已停用" }[status];
}

export function channelWorkspaceStatusColor(status: ChannelWorkspaceStatus) {
    return { enabled: "success", draft: "default", disabled: "default" }[status];
}

export function channelCapabilityLabels(channel: SystemModelChannel) {
    return Array.from(channelDetectedCapabilities(channel)).map((capability) => capabilityLabels[capability]);
}

export function channelProtocolLabel(channel: SystemModelChannel) {
    return channelProtocolDefinition(channel.advancedConfig?.protocol || "auto").label;
}

export function channelWorkspaceKind(channel: SystemModelChannel): ChannelWorkspaceKind {
    const protocol = channel.advancedConfig?.specializedProtocol;
    if (protocol === "xhadmin-digital-human-v1" || protocol === "kling-avatar-v1") return "digital-human";
    if (protocol === "xhadmin-image-human-v1") return "image-human";
    if (protocol === "xhadmin-action-transfer-v1") return "action-transfer";
    return "general";
}

export function channelWorkspaceKindLabel(kind: ChannelWorkspaceKind) {
    return { general: "通用模型", "digital-human": "数字人", "image-human": "图片数字人", "action-transfer": "动作迁移" }[kind];
}

export function specializedProtocolForWorkspaceKind(kind: Exclude<ChannelWorkspaceKind, "general">): SpecializedProviderProtocol {
    if (kind === "digital-human") return "xhadmin-digital-human-v1";
    if (kind === "image-human") return "xhadmin-image-human-v1";
    return "xhadmin-action-transfer-v1";
}

export function removeChannelFromWorkspace(settings: ChannelWorkspaceSettings, channelId: string): ChannelWorkspaceSettings {
    const systemChannels = settings.systemChannels.filter((channel) => channel.id !== channelId);
    const logicalModels = settings.logicalModels.map((model) => ({ ...model, bindings: model.bindings.filter((binding) => binding.channelId !== channelId) })).filter((model) => model.bindings.length);
    const liveIds = new Set(logicalModels.map((model) => model.id));
    return {
        systemChannels,
        logicalModels,
        defaultModels: Object.fromEntries(Object.entries(settings.defaultModels).map(([key, value]) => [key, liveIds.has(value) ? value : ""])) as SystemDefaultModels,
    };
}

export function updateChannelInWorkspace(settings: ChannelWorkspaceSettings, channelId: string, patch: Partial<SystemModelChannel>): ChannelWorkspaceSettings {
    const systemChannels = settings.systemChannels.map((channel) => (channel.id === channelId ? { ...channel, ...patch } : channel));
    return {
        ...settings,
        systemChannels,
        defaultModels: normalizeDefaultModelsConfig(settings.defaultModels, settings.logicalModels, systemChannels),
    };
}

export function defaultModelField(capability: LogicalModelCapability): keyof SystemDefaultModels {
    return capability === "text" ? "textModel" : capability === "image" ? "imageModel" : capability === "video" ? "videoModel" : "audioModel";
}

export function channelBindingCount(channelId: string, settings: ChannelWorkspaceSettings) {
    return settings.logicalModels.reduce((count, model) => count + model.bindings.filter((binding) => binding.channelId === channelId).length, 0);
}

export function channelSearchText(channel: SystemModelChannel) {
    return `${channel.name} ${channel.baseUrl} ${channelProtocolLabel(channel)} ${channel.models.join(" ")}`.toLowerCase();
}
