/**
 * Canvas Project Resources Contracts
 *
 * 项目资源关联、Brief/Task/BrandKit 数据类型定义
 */

// 项目类型
export type CanvasProjectType = "short-drama" | "advertisement" | "brand" | "general";

// 项目状态
export type CanvasProjectStatus = "draft" | "in-progress" | "review" | "completed" | "archived";

// 资源类型
export type CanvasResourceType = "brief" | "task" | "brand-kit" | "image" | "video" | "text" | "audio" | "drawing" | "script" | "character" | "storyboard";

// 引用类型
export type CanvasNodeReferenceType = "uses" | "depends-on" | "references" | "derives-from" | "includes" | "outputs";

// 任务类型
export type CanvasTaskType = "text" | "image" | "video" | "audio" | "generation";

// 任务状态
export type CanvasTaskStatus = "ready" | "pending" | "running" | "paused" | "waiting_user" | "completed" | "failed" | "cancelled";

// 项目元数据
export type CanvasProjectMetadata = {
    budget?: number;
    currency?: string;
    deadline?: string;
    team?: Array<{ userId: string; role: string; name: string }>;
    client?: string;
    description?: string;
    customFields?: Record<string, unknown>;
};

// 项目资源
export type CanvasProjectResource = {
    id: string;
    projectId: string;
    userId: string;
    nodeId: string;
    resourceType: CanvasResourceType;
    resourceRole?: string;
    phase?: string;
    deliverableRef?: string;
    sortOrder: number;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

// 节点引用
export type CanvasNodeReference = {
    id: string;
    projectId: string;
    userId: string;
    sourceNodeId: string;
    targetNodeId: string;
    referenceType: CanvasNodeReferenceType;
    referenceContext?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
};

// Brief 交付物
export type CanvasBriefDeliverable = {
    type: string;
    title: string;
    count?: number;
    ratio?: string;
    requirements?: string[];
};

// Brief 节点数据
export type CanvasBriefNode = {
    id: string;
    projectId: string;
    userId: string;
    nodeId: string;
    objective: string;
    audience?: string;
    usage?: string;
    coreMessage?: string;
    referenceStrategy?: string;
    tone: string[];
    deliverables: CanvasBriefDeliverable[];
    constraints: string[];
    referencedNodeIds: string[];
    version: number;
    createdAt: string;
    updatedAt: string;
};

// Task 节点数据
export type CanvasTaskNode = {
    id: string;
    projectId: string;
    userId: string;
    nodeId: string;
    taskType: CanvasTaskType;
    status: CanvasTaskStatus;
    agentRunId?: string;
    agentTaskId?: string;
    attempts: number;
    maxAttempts: number;
    dependencies: string[];
    outputNodeIds: string[];
    errorMessage?: string;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
};

// BrandKit 节点数据
export type CanvasBrandKitNode = {
    id: string;
    projectId: string;
    userId: string;
    nodeId: string;
    summary?: string;
    style?: string;
    composition?: string;
    colors: string[];
    lighting?: string;
    keywords: string[];
    visualKeywords: string[];
    avoid: string[];
    typography: string[];
    approvedNodeIds: string[];
    rejectedNodeIds: string[];
    version: number;
    createdAt: string;
    updatedAt: string;
};

// 项目资源摘要（用于仪表板）
export type CanvasProjectResourceSummary = {
    projectId: string;
    totalResources: number;
    briefCount: number;
    taskCount: number;
    brandKitCount: number;
    imageCount: number;
    videoCount: number;
    completedTasks: number;
    pendingTasks: number;
    failedTasks: number;
    recentResources: Array<{
        nodeId: string;
        resourceType: CanvasResourceType;
        title?: string;
        updatedAt: string;
    }>;
};

// 节点依赖图
export type CanvasNodeDependencyGraph = {
    nodeId: string;
    dependencies: string[];
    dependents: string[];
    references: Array<{
        targetNodeId: string;
        referenceType: CanvasNodeReferenceType;
    }>;
    referencedBy: Array<{
        sourceNodeId: string;
        referenceType: CanvasNodeReferenceType;
    }>;
};

// 创建资源输入
export type CreateCanvasResourceInput = {
    nodeId: string;
    resourceType: CanvasResourceType;
    resourceRole?: string;
    phase?: string;
    deliverableRef?: string;
    sortOrder?: number;
    metadata?: Record<string, unknown>;
};

// 创建 Brief 输入
export type CreateCanvasBriefInput = {
    nodeId: string;
    objective: string;
    audience?: string;
    usage?: string;
    coreMessage?: string;
    referenceStrategy?: string;
    tone?: string[];
    deliverables?: CanvasBriefDeliverable[];
    constraints?: string[];
    referencedNodeIds?: string[];
};

// 创建 Task 输入
export type CreateCanvasTaskInput = {
    nodeId: string;
    taskType: CanvasTaskType;
    status?: CanvasTaskStatus;
    dependencies?: string[];
    maxAttempts?: number;
};

// 创建 BrandKit 输入
export type CreateCanvasBrandKitInput = {
    nodeId: string;
    summary?: string;
    style?: string;
    composition?: string;
    colors?: string[];
    lighting?: string;
    keywords?: string[];
    visualKeywords?: string[];
    avoid?: string[];
    typography?: string[];
    approvedNodeIds?: string[];
    rejectedNodeIds?: string[];
};

// 更新 Brief 输入
export type UpdateCanvasBriefInput = Partial<Omit<CreateCanvasBriefInput, "nodeId">>;

// 更新 Task 输入
export type UpdateCanvasTaskInput = Partial<Omit<CreateCanvasTaskInput, "nodeId">> & {
    agentRunId?: string;
    agentTaskId?: string;
    errorMessage?: string;
    startedAt?: string;
    completedAt?: string;
};

// 更新 BrandKit 输入
export type UpdateCanvasBrandKitInput = Partial<Omit<CreateCanvasBrandKitInput, "nodeId">>;

// 创建节点引用输入
export type CreateCanvasNodeReferenceInput = {
    sourceNodeId: string;
    targetNodeId: string;
    referenceType: CanvasNodeReferenceType;
    referenceContext?: string;
    metadata?: Record<string, unknown>;
};

// 项目搜索选项
export type CanvasProjectSearchOptions = {
    query?: string;
    projectType?: CanvasProjectType;
    projectStatus?: CanvasProjectStatus;
    tags?: string[];
    resourceType?: CanvasResourceType;
    limit?: number;
    offset?: number;
};

// 项目搜索结果
export type CanvasProjectSearchResult = {
    projectId: string;
    title: string;
    projectType?: CanvasProjectType;
    projectStatus: CanvasProjectStatus;
    tags: string[];
    matchedResources: Array<{
        nodeId: string;
        resourceType: CanvasResourceType;
        title?: string;
        snippet?: string;
    }>;
    updatedAt: string;
};
