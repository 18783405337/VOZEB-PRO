/**
 * Canvas Skill Execution Engine
 *
 * 技能执行引擎，处理各种技能的实际执行逻辑
 */

import type { SkillTemplate, SkillOutput, SkillOutputMode } from "@/app/(user)/canvas/skill-types";

/**
 * 技能执行上下文
 */
export type SkillExecutionContext = {
    userId: string;
    projectId: string;
    skillId: string;
    templateId: string;
    parameters: Record<string, unknown>;
};

/**
 * 技能执行结果
 */
export type SkillExecutionResult = {
    success: boolean;
    output?: SkillOutput;
    error?: string;
    executionTimeMs: number;
};

/**
 * 技能执行引擎
 */
export class SkillExecutionEngine {
    /**
     * 执行技能
     */
    static async execute(
        template: SkillTemplate,
        context: SkillExecutionContext
    ): Promise<SkillExecutionResult> {
        const startTime = Date.now();

        try {
            // 验证参数
            this.validateParameters(template, context.parameters);

            // 根据模板 ID 执行相应的技能逻辑
            const output = await this.executeSkill(template, context);

            const executionTimeMs = Date.now() - startTime;

            return {
                success: true,
                output,
                executionTimeMs,
            };
        } catch (error) {
            const executionTimeMs = Date.now() - startTime;

            return {
                success: false,
                error: error instanceof Error ? error.message : "执行失败",
                executionTimeMs,
            };
        }
    }

    /**
     * 验证参数
     */
    private static validateParameters(
        template: SkillTemplate,
        parameters: Record<string, unknown>
    ): void {
        for (const param of template.parameters) {
            if (param.required && !(param.name in parameters)) {
                throw new Error(`缺少必填参数: ${param.label}`);
            }

            const value = parameters[param.name];

            // 类型验证
            if (value !== undefined && value !== null) {
                switch (param.type) {
                    case "number":
                    case "range":
                        if (typeof value !== "number") {
                            throw new Error(`参数 ${param.label} 必须是数字`);
                        }
                        if (param.min !== undefined && value < param.min) {
                            throw new Error(`参数 ${param.label} 不能小于 ${param.min}`);
                        }
                        if (param.max !== undefined && value > param.max) {
                            throw new Error(`参数 ${param.label} 不能大于 ${param.max}`);
                        }
                        break;

                    case "boolean":
                        if (typeof value !== "boolean") {
                            throw new Error(`参数 ${param.label} 必须是布尔值`);
                        }
                        break;

                    case "string":
                        if (typeof value !== "string") {
                            throw new Error(`参数 ${param.label} 必须是字符串`);
                        }
                        break;
                }
            }
        }
    }

    /**
     * 执行具体技能
     */
    private static async executeSkill(
        template: SkillTemplate,
        context: SkillExecutionContext
    ): Promise<SkillOutput> {
        switch (template.id) {
            case "image-resize":
                return this.executeImageResize(context.parameters);

            case "image-filter":
                return this.executeImageFilter(context.parameters);

            case "text-summarize":
                return this.executeTextSummarize(context.parameters);

            case "video-trim":
                return this.executeVideoTrim(context.parameters);

            case "audio-normalize":
                return this.executeAudioNormalize(context.parameters);

            default:
                throw new Error(`未知的技能模板: ${template.id}`);
        }
    }

    /**
     * 图像调整大小
     */
    private static async executeImageResize(
        parameters: Record<string, unknown>
    ): Promise<SkillOutput> {
        // 模拟图像处理
        await this.simulateProcessing(1000);

        return {
            mode: "node",
            data: {
                width: parameters.width,
                height: parameters.height,
                maintainAspectRatio: parameters.maintainAspectRatio,
            },
            nodeId: `node-${Date.now()}`,
            metadata: {
                processedAt: new Date().toISOString(),
            },
        };
    }

    /**
     * 图像滤镜
     */
    private static async executeImageFilter(
        parameters: Record<string, unknown>
    ): Promise<SkillOutput> {
        await this.simulateProcessing(1500);

        return {
            mode: "node",
            data: {
                filter: parameters.filter,
                intensity: parameters.intensity,
            },
            nodeId: `node-${Date.now()}`,
            metadata: {
                processedAt: new Date().toISOString(),
            },
        };
    }

    /**
     * 文本摘要
     */
    private static async executeTextSummarize(
        parameters: Record<string, unknown>
    ): Promise<SkillOutput> {
        await this.simulateProcessing(2000);

        const mockSummary = "这是一个自动生成的文本摘要示例。实际使用中，这里会调用 AI 服务生成真实的摘要内容。";

        return {
            mode: "inline",
            data: {
                summary: mockSummary,
                originalLength: 1000,
                summaryLength: mockSummary.length,
                style: parameters.style,
            },
            metadata: {
                processedAt: new Date().toISOString(),
            },
        };
    }

    /**
     * 视频裁剪
     */
    private static async executeVideoTrim(
        parameters: Record<string, unknown>
    ): Promise<SkillOutput> {
        await this.simulateProcessing(3000);

        return {
            mode: "node",
            data: {
                startTime: parameters.startTime,
                endTime: parameters.endTime,
                duration: (parameters.endTime as number) - (parameters.startTime as number),
            },
            nodeId: `node-${Date.now()}`,
            metadata: {
                processedAt: new Date().toISOString(),
            },
        };
    }

    /**
     * 音频标准化
     */
    private static async executeAudioNormalize(
        parameters: Record<string, unknown>
    ): Promise<SkillOutput> {
        await this.simulateProcessing(2500);

        return {
            mode: "node",
            data: {
                targetDb: parameters.targetDb,
            },
            nodeId: `node-${Date.now()}`,
            metadata: {
                processedAt: new Date().toISOString(),
            },
        };
    }

    /**
     * 模拟处理延迟
     */
    private static async simulateProcessing(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * 进度更新回调类型
 */
export type ProgressCallback = (progress: number) => void;

/**
 * 带进度的技能执行
 */
export async function executeSkillWithProgress(
    template: SkillTemplate,
    context: SkillExecutionContext,
    onProgress?: ProgressCallback
): Promise<SkillExecutionResult> {
    // 模拟进度更新
    const progressInterval = setInterval(() => {
        const randomProgress = Math.floor(Math.random() * 30) + 10;
        onProgress?.(Math.min(randomProgress, 90));
    }, 500);

    try {
        const result = await SkillExecutionEngine.execute(template, context);
        onProgress?.(100);
        return result;
    } finally {
        clearInterval(progressInterval);
    }
}
