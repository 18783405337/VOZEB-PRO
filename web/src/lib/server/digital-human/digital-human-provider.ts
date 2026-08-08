import type { SpecializedProviderContext, SpecializedProviderTaskState } from "@/lib/server/specialized-provider/provider-types";

export type DigitalHumanProviderAsset = Readonly<{
    mediaUrl: string;
    providerAssetId?: string;
}>;

export type DigitalHumanProviderRequest = Readonly<{
    localTaskId: string;
    scriptText: string;
    avatar: DigitalHumanProviderAsset;
    voice: DigitalHumanProviderAsset;
    providerParams?: Record<string, unknown>;
}>;

export type DigitalHumanProviderSubmission = Readonly<{
    taskId: string;
    payload: Record<string, unknown>;
}>;

export type DigitalHumanProviderResult = Readonly<{
    state: SpecializedProviderTaskState;
    mediaUrl: string;
    error: string;
    payload: Record<string, unknown>;
}>;

export interface DigitalHumanProvider {
    readonly protocol: SpecializedProviderContext["protocol"];
    submitTts(request: DigitalHumanProviderRequest, context: SpecializedProviderContext): Promise<DigitalHumanProviderSubmission>;
    queryTts(taskId: string, context: SpecializedProviderContext): Promise<DigitalHumanProviderResult>;
    submitAvatar(request: DigitalHumanProviderRequest, audioUrl: string, context: SpecializedProviderContext): Promise<DigitalHumanProviderSubmission>;
    queryAvatar(taskId: string, context: SpecializedProviderContext): Promise<DigitalHumanProviderResult>;
}

export class UnsupportedDigitalHumanProviderOperation extends Error {
    constructor(
        readonly protocol: SpecializedProviderContext["protocol"],
        readonly operation: "tts" | "avatar",
    ) {
        super(`Protocol ${protocol} does not support the ${operation} operation`);
        this.name = "UnsupportedDigitalHumanProviderOperation";
    }
}
