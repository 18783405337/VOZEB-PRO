import type { CreativeReview } from "@/lib/creative-agent-contract";
import type { CreativeAsset } from "@/lib/creative-runtime-contract";
import type { AgentRunReference, AgentRunTask } from "@/lib/server/agent-run-store";

export function textConstraintInstruction(prompt: string, type: AgentRunTask["type"]) {
    if (type !== "text") return "";
    const limit = requestedTextLimit(prompt);
    const concise = /只需要|只返回|只输出|不要解释|直接(?:给|说|返回|输出)|别(?:解释|啰嗦|展开)/.test(prompt);
    return limit || concise ? `\n\n严格输出要求：${limit ? `最终结果不得超过 ${limit} 个 Unicode 字符；` : ""}${concise ? "只输出最终文本，不要标题、Markdown、解释或列表。" : ""}` : "";
}

export function normalizeConstrainedTextResult(task: AgentRunTask, value: unknown, attempt: number) {
    if (task.type !== "text" || !value || typeof value !== "object") return value;
    const limit = requestedTextLimit(task.prompt);
    const content = String((value as Record<string, unknown>).content || "").trim();
    if (!limit || Array.from(content).length <= limit) return value;
    if (attempt < 3) throw new Error(`文本超过 ${limit} 字限制，正在自动重写`);
    return { ...(value as Record<string, unknown>), content: Array.from(content).slice(0, limit).join("") };
}

export function requestedTextLimit(prompt: string) {
    return Number(prompt.match(/(?:不超过|最多|控制在|限|)(\d{1,3})\s*字(?:以内|以下|之内)?/)?.[1] || 0);
}

export function taskReferences(task: AgentRunTask): AgentRunReference[] {
    if (task.references?.length) return task.references;
    return task.referenceUrl && task.referenceType ? [{ assetId: task.referenceAssetId, url: task.referenceUrl, type: task.referenceType }] : [];
}

export function mergeTaskReferences(current: AgentRunReference[], additions: AgentRunReference[]) {
    const references = new Map(current.map((item) => [`${item.type}:${item.url}`, item]));
    additions.forEach((item) => references.set(`${item.type}:${item.url}`, item));
    return Array.from(references.values()).slice(0, 20);
}

export function acceptsMediaReference(taskType: AgentRunTask["type"], assetType: CreativeAsset["type"]): assetType is "image" | "video" | "audio" {
    if (taskType === "image") return assetType === "image";
    if (taskType === "video") return assetType === "image" || assetType === "video" || assetType === "audio";
    return false;
}

export function taskResultItems(value: unknown): Record<string, unknown>[] {
    if (!value || typeof value !== "object") return [{}];
    const record = value as Record<string, unknown>;
    const list = [record.results, record.images, record.outputs, record.items].find(Array.isArray);
    if (!Array.isArray(list) || !list.length) return [record];
    return list.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").slice(0, 10);
}

export function taskImageUrls(value: unknown) {
    return taskResultItems(value)
        .map((record) => [record.remoteUrl, record.serverUrl, record.url, record.dataUrl].find((item) => typeof item === "string" && item.trim()))
        .filter((item): item is string => typeof item === "string")
        .slice(0, 6);
}

export function reviewCorrection(review: CreativeReview, taskId: string) {
    const issues = review.issues.filter((issue) => issue.taskId === taskId);
    return issues.length ? issues.map((issue) => `${issue.category}：${issue.correction || issue.message}`).join("；") : "加强与创作简报、视觉方向和依赖产物的一致性。";
}
