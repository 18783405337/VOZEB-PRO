/**
 * Canvas Script 节点类型定义
 *
 * 支持 Tiptap 富文本编辑器，具备 Markdown 导入导出功能
 */

/**
 * 脚本文档数据结构
 */
export type CanvasScriptDocument = {
    /** 脚本文档唯一标识 */
    scriptId: string;
    /** 所属画布项目 ID */
    projectId: string;
    /** 文档标题 */
    title: string;
    /** Tiptap JSON 格式内容 */
    content: unknown;
    /** Markdown 格式内容 (用于导出) */
    markdown?: string;
    /** 纯文本内容 (用于搜索) */
    plainText: string;
    /** 字符数 */
    characterCount: number;
    /** 单词数 */
    wordCount: number;
    /** 文档版本号 */
    revision: number;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
};

/**
 * 脚本文档版本历史
 */
export type CanvasScriptVersion = {
    /** 版本号 */
    revision: number;
    /** 版本内容快照 */
    content: unknown;
    /** Markdown 快照 */
    markdown?: string;
    /** 创建时间 */
    createdAt: string;
    /** 变更描述 */
    description?: string;
    /** 字符数 */
    characterCount: number;
    /** 单词数 */
    wordCount: number;
};

/**
 * LocalForage 存储键格式
 */
export type CanvasScriptStorageKey = {
    /** 项目 ID */
    projectId: string;
    /** 脚本 ID */
    scriptId: string;
};

/**
 * 脚本编辑器配置
 */
export type CanvasScriptEditorConfig = {
    /** 是否只读 */
    readOnly?: boolean;
    /** 自动保存间隔 (ms) */
    autoSaveInterval?: number;
    /** 是否显示工具栏 */
    showToolbar?: boolean;
    /** 初始内容 (Tiptap JSON) */
    initialContent?: unknown;
    /** 初始 Markdown */
    initialMarkdown?: string;
    /** 占位符文本 */
    placeholder?: string;
};

/**
 * Tiptap 编辑器扩展配置
 */
export type TiptapExtensionConfig = {
    /** 启用代码块 */
    enableCodeBlock?: boolean;
    /** 启用表格 */
    enableTable?: boolean;
    /** 启用任务列表 */
    enableTaskList?: boolean;
    /** 启用图片 */
    enableImage?: boolean;
    /** 启用链接 */
    enableLink?: boolean;
    /** 启用高亮 */
    enableHighlight?: boolean;
    /** 最大字符数 */
    characterLimit?: number;
};

/**
 * 脚本导出选项
 */
export type CanvasScriptExportOptions = {
    /** 导出格式 */
    format: "markdown" | "html" | "json" | "text";
    /** 是否包含元数据 */
    includeMetadata?: boolean;
    /** 是否美化输出 */
    prettify?: boolean;
};

/**
 * 脚本统计信息
 */
export type CanvasScriptStats = {
    /** 字符总数 */
    characterCount: number;
    /** 单词总数 */
    wordCount: number;
    /** 段落数 */
    paragraphCount: number;
    /** 标题数 */
    headingCount: number;
    /** 列表项数 */
    listItemCount: number;
    /** 代码块数 */
    codeBlockCount: number;
    /** 最后编辑时间 */
    lastEditedAt: string;
    /** 编辑次数 */
    editCount: number;
};

/**
 * Markdown 导入结果
 */
export type MarkdownImportResult = {
    /** 导入成功 */
    success: boolean;
    /** Tiptap JSON 内容 */
    content?: unknown;
    /** 错误信息 */
    error?: string;
    /** 统计信息 */
    stats?: {
        characterCount: number;
        wordCount: number;
    };
};
