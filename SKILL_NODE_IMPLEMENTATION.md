# Canvas Skill 节点实现文档

## 概述

Skill 节点是 Canvas 中的技能执行系统，允许用户通过预定义的技能模板执行各种处理任务（图像处理、视频编辑、音频处理、文本生成等）。

本实现参考了 Drawing 节点的架构模式，提供了完整的技能管理、执行和输出系统。

## 技术架构

### 1. 类型系统

#### 文件位置
- `/web/src/app/(user)/canvas/skill-types.ts` - 技能节点类型定义

#### 核心类型

```typescript
// 技能分类
export type SkillCategory =
    | "image-processing"    // 图像处理
    | "video-editing"       // 视频编辑
    | "audio-processing"    // 音频处理
    | "text-generation"     // 文本生成
    | "data-analysis"       // 数据分析
    | "automation"          // 自动化
    | "custom";             // 自定义

// 技能输出模式
export type SkillOutputMode =
    | "inline"      // 内联输出（显示在节点内）
    | "node"        // 节点输出（创建新节点）
    | "download"    // 下载输出（生成文件下载）
    | "preview";    // 预览输出（显示预览界面）

// 技能模板
export type SkillTemplate = {
    id: string;
    name: string;
    description: string;
    category: SkillCategory;
    icon: string;
    parameters: SkillParameter[];
    outputMode: SkillOutputMode;
    builtin: boolean;
    createdAt: string;
    updatedAt: string;
};

// 技能实例数据
export type SkillInstanceData = {
    templateId: string;
    parameters: Record<string, unknown>;
    status: "idle" | "running" | "success" | "error";
    progress?: number;
    output?: SkillOutput;
    error?: string;
    lastExecutedAt?: string;
};
```

### 2. 数据服务层

#### 文件位置
- `/web/src/lib/server/canvas-skill-service.ts` - 技能文档业务逻辑

#### 核心功能

```typescript
// 创建技能文档
createSkillDocument(userId, projectId, data)

// 获取技能文档
getSkillDocument(userId, projectId, skillId, includeOutput)

// 更新技能文档
updateSkillDocument(userId, projectId, skillId, data)

// 删除技能文档
deleteSkillDocument(userId, projectId, skillId)

// 获取执行历史
getSkillExecutionHistory(userId, projectId, skillId, limit)

// 记录执行历史
recordSkillExecution(userId, projectId, skillId, data)

// 获取统计信息
getSkillStats(userId, projectId, skillId)
```

### 3. 数据库 Schema

#### 文件位置
- `/web/src/lib/server/database/migrations/002_create_canvas_skill_tables.up.sql`
- `/web/src/lib/server/database/migrations/002_create_canvas_skill_tables.down.sql`

#### 表结构

**canvas_skill_documents** - 技能文档表
```sql
- id: UUID (主键)
- project_id: UUID (项目ID)
- user_id: UUID (用户ID)
- skill_id: TEXT (技能ID，唯一)
- template_id: TEXT (模板ID)
- name: TEXT (技能名称)
- parameters: JSONB (参数配置)
- status: TEXT (执行状态: idle/running/success/error)
- progress: INTEGER (执行进度 0-100)
- output: JSONB (输出结果)
- error: TEXT (错误信息)
- last_executed_at: TIMESTAMP (最后执行时间)
- created_at: TIMESTAMP (创建时间)
- updated_at: TIMESTAMP (更新时间)
```

**canvas_skill_execution_history** - 执行历史表
```sql
- id: UUID (主键)
- skill_document_id: UUID (关联技能文档)
- status: TEXT (执行状态: success/error)
- parameters: JSONB (执行参数)
- output: JSONB (输出结果)
- error: TEXT (错误信息)
- execution_time_ms: INTEGER (执行时间，毫秒)
- created_at: TIMESTAMP (创建时间)
```

### 4. 前端组件

#### 核心组件

**CanvasSkillNode** - 技能节点主组件
- 文件: `/web/src/app/(user)/canvas/components/canvas-skill-node.tsx`
- 功能: 显示技能参数、执行状态、进度条、输出结果

**CanvasSkillNodeWrapper** - 节点包装器
- 文件: `/web/src/app/(user)/canvas/components/canvas-skill-node-wrapper.tsx`
- 功能: 处理动态导入和 SSR 兼容性

**SkillTemplateSelector** - 模板选择器
- 文件: `/web/src/app/(user)/canvas/components/canvas-skill-template-selector.tsx`
- 功能: 展示内置和自定义技能模板，支持搜索和分类筛选

### 5. 执行引擎

#### 文件位置
- `/web/src/app/(user)/canvas/utils/canvas-skill-execution.ts`

#### 核心类

```typescript
export class SkillExecutionEngine {
    // 执行技能
    static async execute(template, context): Promise<SkillExecutionResult>
    
    // 验证参数
    private static validateParameters(template, parameters)
    
    // 执行具体技能
    private static async executeSkill(template, context): Promise<SkillOutput>
}

// 带进度的执行
export async function executeSkillWithProgress(
    template: SkillTemplate,
    context: SkillExecutionContext,
    onProgress?: ProgressCallback
): Promise<SkillExecutionResult>
```

### 6. API 端点

#### 路由结构

**GET** `/api/canvas/[projectId]/skills`
- 获取项目的所有技能列表
- 支持分页、按模板筛选、按状态筛选

**POST** `/api/canvas/[projectId]/skills`
- 创建新的技能文档

**GET** `/api/canvas/[projectId]/skills/[skillId]`
- 获取单个技能文档详情

**PATCH** `/api/canvas/[projectId]/skills/[skillId]`
- 更新技能文档

**DELETE** `/api/canvas/[projectId]/skills/[skillId]`
- 删除技能文档

**POST** `/api/canvas/[projectId]/skills/[skillId]/execute`
- 执行技能
- 自动更新执行状态和记录历史

### 7. 本地存储

#### 文件位置
- `/web/src/app/(user)/canvas/utils/canvas-skill-storage.ts`

#### 功能
- 使用 LocalForage 存储技能参数
- 支持保存/加载/删除操作
- 提供项目级清理功能

## 内置技能模板

### 1. 图像调整大小 (image-resize)
- 分类: 图像处理
- 参数: width, height, maintainAspectRatio
- 输出: 创建新节点

### 2. 图像滤镜 (image-filter)
- 分类: 图像处理
- 参数: filter (灰度/模糊/锐化/复古/高对比), intensity
- 输出: 创建新节点

### 3. 文本摘要 (text-summarize)
- 分类: 文本生成
- 参数: maxLength, style (简洁/详细/要点式)
- 输出: 内联显示

### 4. 视频裁剪 (video-trim)
- 分类: 视频编辑
- 参数: startTime, endTime
- 输出: 创建新节点

### 5. 音频标准化 (audio-normalize)
- 分类: 音频处理
- 参数: targetDb
- 输出: 创建新节点

## 集成到画布

### 1. 更新类型定义

在 `/web/src/app/(user)/canvas/types.ts` 中添加:

```typescript
export enum CanvasNodeType {
    // ... 其他类型
    Skill = "skill",
}

export type CanvasNodeMetadata = {
    // ... 其他元数据
    skillId?: string;
    skillTemplateId?: string;
    skillStatus?: "idle" | "running" | "success" | "error";
    skillProgress?: number;
    skillParameters?: Record<string, unknown>;
    skillOutput?: any;
    skillError?: string;
    skillLastExecutedAt?: string;
};
```

### 2. 更新节点内容渲染器

在 `/web/src/app/(user)/canvas/components/canvas-node-content.tsx` 中:

```typescript
import { Wand2 } from "lucide-react";

export const nodeContentRenderers = {
    // ... 其他渲染器
    [CanvasNodeType.Skill]: SkillNodeContent,
};

export function SkillNodeContent({ node, theme }: NodeContentRendererProps) {
    const CanvasSkillNodeWrapper = React.lazy(() =>
        import("./canvas-skill-node-wrapper").then((mod) => ({ 
            default: mod.CanvasSkillNodeWrapper 
        }))
    );

    return (
        <React.Suspense fallback={<Wand2 className="size-8 text-gray-400" />}>
            <CanvasSkillNodeWrapper node={node} theme={theme} />
        </React.Suspense>
    );
}
```

### 3. 更新节点默认配置

在 `/web/src/app/(user)/canvas/constants.ts` 中:

```typescript
export const NODE_DEFAULT_SIZE = {
    // ... 其他节点
    [CanvasNodeType.Skill]: { width: 400, height: 320, title: "技能节点" },
};

const NODE_SPECS = {
    // ... 其他节点
    [CanvasNodeType.Skill]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Skill],
        metadata: {
            status: "idle",
            skillId: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            skillTemplateId: "",
            skillStatus: "idle",
            skillProgress: 0,
            skillParameters: {},
        },
    },
};
```

### 4. 添加创建菜单选项

在画布创建菜单中添加 Skill 节点选项:

```tsx
<ConnectionCreateOption 
    theme={theme} 
    icon={<Wand2 className="size-5" />} 
    title="技能节点" 
    description="执行预设技能和自动化任务" 
    onClick={() => onCreate(CanvasNodeType.Skill)} 
/>
```

## 使用流程

### 1. 创建技能节点
1. 用户在画布中创建新的 Skill 节点
2. 系统自动生成 skillId 和初始元数据
3. 节点显示为 "idle" 状态

### 2. 选择模板
1. 用户打开技能模板选择器
2. 浏览或搜索内置/自定义模板
3. 选择模板后，节点加载模板配置

### 3. 配置参数
1. 节点显示模板的所有参数
2. 用户填写或调整参数值
3. 参数自动保存到本地存储

### 4. 执行技能
1. 用户点击"执行技能"按钮
2. 调用 API 开始执行
3. 显示进度条和执行状态
4. 执行完成后显示结果

### 5. 查看输出
- **内联模式**: 结果直接显示在节点内
- **节点模式**: 创建新节点包含输出内容
- **下载模式**: 提供文件下载链接
- **预览模式**: 打开预览窗口

## 扩展性

### 添加自定义技能模板

1. 在 `skill-types.ts` 中定义新模板:

```typescript
export const CUSTOM_SKILL_TEMPLATES: SkillTemplate[] = [
    {
        id: "custom-skill-id",
        name: "自定义技能名称",
        description: "技能描述",
        category: "custom",
        icon: "IconName",
        parameters: [
            // 参数定义
        ],
        outputMode: "node",
        builtin: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];
```

2. 在执行引擎中添加处理逻辑:

```typescript
private static async executeSkill(template, context) {
    switch (template.id) {
        case "custom-skill-id":
            return this.executeCustomSkill(context.parameters);
        // ... 其他技能
    }
}

private static async executeCustomSkill(parameters) {
    // 实现自定义逻辑
    return {
        mode: "node",
        data: { /* 输出数据 */ },
        metadata: { /* 元数据 */ },
    };
}
```

### 添加新的输出模式

可以在 `SkillOutputMode` 类型中添加新的输出模式，并在组件中处理相应的显示逻辑。

## 最佳实践

1. **参数验证**: 始终验证用户输入的参数
2. **错误处理**: 提供清晰的错误信息
3. **进度反馈**: 长时间运行的技能应提供进度更新
4. **历史记录**: 记录每次执行以便调试
5. **资源清理**: 执行完成后清理临时资源
6. **权限检查**: 确保用户有权限执行技能

## 性能优化

1. **懒加载**: 使用 React.lazy() 动态导入组件
2. **缓存**: 缓存模板列表和执行结果
3. **并发控制**: 限制同时执行的技能数量
4. **增量更新**: 只更新变化的数据

## 安全考虑

1. **输入验证**: 服务端验证所有参数
2. **权限控制**: 检查用户对项目的访问权限
3. **资源限制**: 限制执行时间和资源使用
4. **敏感数据**: 不在客户端存储敏感信息

## 测试建议

1. **单元测试**: 测试执行引擎和参数验证
2. **集成测试**: 测试 API 端点和数据库操作
3. **E2E 测试**: 测试完整的用户工作流
4. **性能测试**: 测试大量并发执行的性能

## 故障排除

### 常见问题

1. **技能执行失败**
   - 检查参数是否正确
   - 查看执行历史中的错误信息
   - 验证模板是否存在

2. **进度不更新**
   - 检查网络连接
   - 查看浏览器控制台错误
   - 验证 WebSocket 连接

3. **输出不显示**
   - 检查输出模式配置
   - 验证输出数据格式
   - 查看组件渲染逻辑

## 未来改进

1. 支持技能链式执行
2. 添加技能市场和分享功能
3. 实现实时协作编辑
4. 支持更多输出格式
5. 添加技能性能分析工具
6. 支持条件执行和循环
7. 集成更多第三方服务

## 总结

Skill 节点系统提供了一个灵活、可扩展的技能执行框架，完整实现了从模板管理、参数配置、执行引擎到结果展示的全流程。该系统参考了 Drawing 节点的成熟架构，确保了与现有系统的良好集成。
