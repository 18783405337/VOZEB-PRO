# Canvas Script Node - 开发文档

## 概述

Canvas Script 节点是画布系统的富文本编辑功能，基于 Tiptap 编辑器实现，支持 Markdown 导入导出、版本历史、自动保存等功能。

## 架构设计

### 1. 数据库层

**表结构：**

- `canvas_script_documents` - 脚本文档主表
  - 存储脚本内容（Tiptap JSON）、Markdown、纯文本
  - 包含字符数、单词数统计
  - 版本号追踪

- `canvas_script_versions` - 版本历史表
  - 保存每个版本的完整快照
  - 支持版本回滚

**迁移文件：**
- `002_create_canvas_script_tables.up.sql`
- `002_create_canvas_script_tables.down.sql`

### 2. 服务层

**文件：** `web/src/lib/server/canvas-script-service.ts`

**主要功能：**
- `createScriptDocument()` - 创建脚本文档
- `getScriptDocument()` - 获取单个文档
- `listScriptDocuments()` - 列出所有文档（支持搜索）
- `updateScriptDocument()` - 更新文档（自动创建版本）
- `deleteScriptDocument()` - 删除文档
- `getScriptVersions()` - 获取版本历史
- `restoreScriptVersion()` - 恢复到指定版本

### 3. API 端点

**基础路由：** `/api/canvas/[projectId]/scripts`

**端点列表：**

```
GET    /api/canvas/[projectId]/scripts
       列出项目的所有脚本
       查询参数: page, limit, search

POST   /api/canvas/[projectId]/scripts
       创建新脚本文档
       请求体: { scriptId, title, content, markdown, ... }

GET    /api/canvas/[projectId]/scripts/[scriptId]
       获取单个脚本文档
       查询参数: includeContent (默认 true)

PUT    /api/canvas/[projectId]/scripts/[scriptId]
       更新脚本文档
       请求体: { title, content, markdown, plainText, ... }

DELETE /api/canvas/[projectId]/scripts/[scriptId]
       删除脚本文档

GET    /api/canvas/[projectId]/scripts/[scriptId]/versions
       获取版本历史
       查询参数: limit (默认 10)

GET    /api/canvas/[projectId]/scripts/[scriptId]/versions/[revision]
       获取特定版本的内容

POST   /api/canvas/[projectId]/scripts/[scriptId]/restore
       恢复到指定版本
       请求体: { revision }
```

### 4. 前端组件

**主要组件：**

1. **TiptapEditor** (`canvas-script-tiptap-editor.tsx`)
   - 基于 @tiptap/react 的富文本编辑器
   - 支持扩展：StarterKit, Link, Highlight, TaskList, Table, CharacterCount
   - 实时统计字符数和单词数

2. **CanvasScriptNode** (`canvas-script-node.tsx`)
   - 脚本节点的主要逻辑组件
   - 处理数据加载、自动保存、本地缓存
   - 显示保存状态和统计信息

3. **CanvasScriptNodeWrapper** (`canvas-script-node-wrapper.tsx`)
   - 动态导入包装器，避免 SSR 问题
   - 提供加载状态和错误处理

### 5. 工具函数

**Markdown 转换** (`canvas-script-markdown.ts`)
- `extractPlainText()` - 从 Tiptap JSON 提取纯文本
- `calculateTextStats()` - 计算字符数和单词数
- `tiptapToMarkdown()` - 转换为 Markdown 格式
- `validateTiptapContent()` - 验证内容格式
- `createEmptyTiptapDocument()` - 创建空文档

**本地存储** (`canvas-script-storage.ts`)
- 使用 LocalForage 管理本地缓存
- 支持离线编辑和快速加载
- 自动清理过期缓存

## 功能特性

### 1. 富文本编辑

支持的格式：
- 标题（H1-H6）
- 粗体、斜体、删除线、高亮
- 链接
- 代码块（支持语法高亮）
- 无序列表、有序列表
- 任务列表（可勾选）
- 表格
- 引用块
- 水平分隔线

### 2. 自动保存

- 编辑后 2 秒自动保存
- 保存到服务器和本地缓存
- 显示保存状态（保存中、已保存、错误）
- 显示最后保存时间

### 3. 版本历史

- 每次手动保存创建新版本（自动保存不创建版本）
- 支持查看历史版本
- 支持恢复到任意版本
- 版本包含完整内容快照和元数据

### 4. Markdown 支持

- 自动转换为 Markdown 格式
- 支持 Markdown 导出
- 未来可支持 Markdown 导入

### 5. 统计信息

实时显示：
- 字符数
- 单词数
- 段落数（可扩展）

### 6. 本地缓存

- 首次加载优先使用本地缓存
- 离线时可继续编辑
- 联网后自动同步到服务器
- 自动清理过期缓存（30 天）

## 使用方式

### 在画布中创建 Script 节点

```typescript
import { CanvasNodeType } from "@/app/(user)/canvas/types";

const scriptNode = {
    id: generateId(),
    type: CanvasNodeType.Script,
    title: "新建脚本",
    position: { x: 100, y: 100 },
    width: 600,
    height: 400,
    metadata: {
        scriptId: generateScriptId(), // 唯一标识
    },
};
```

### 渲染 Script 节点

```typescript
import { CanvasScriptNodeWrapper } from "./components/canvas-script-node-wrapper";

// 在节点渲染逻辑中
if (node.type === CanvasNodeType.Script) {
    return <CanvasScriptNodeWrapper node={node} theme={theme} />;
}
```

### API 调用示例

```typescript
// 创建脚本
const response = await fetch(`/api/canvas/${projectId}/scripts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        scriptId: "script-123",
        title: "我的脚本",
        content: { type: "doc", content: [...] },
        markdown: "# 标题\n\n内容...",
        plainText: "标题 内容...",
        characterCount: 100,
        wordCount: 20,
    }),
});

// 更新脚本
await fetch(`/api/canvas/${projectId}/scripts/script-123`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        content: updatedContent,
        createVersion: true, // 创建新版本
    }),
});

// 获取版本历史
const versions = await fetch(
    `/api/canvas/${projectId}/scripts/script-123/versions?limit=10`
);

// 恢复版本
await fetch(`/api/canvas/${projectId}/scripts/script-123/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision: 5 }),
});
```

## 数据库迁移

### 运行迁移

```typescript
import {
    runScriptMigrationUp,
    runScriptMigrationDown,
    checkScriptTablesExist,
} from "@/lib/server/database/canvas-script-migration";

// 创建表
await runScriptMigrationUp();

// 检查表是否存在
const exists = await checkScriptTablesExist();

// 删除表（仅开发环境）
await runScriptMigrationDown();
```

## 类型定义

详细的 TypeScript 类型定义参见：
- `web/src/app/(user)/canvas/script-types.ts`
- `web/src/app/(user)/canvas/types.ts`

## 依赖包

需要安装的 npm 包：

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder \
    @tiptap/extension-link @tiptap/extension-highlight \
    @tiptap/extension-task-list @tiptap/extension-task-item \
    @tiptap/extension-table @tiptap/extension-table-row \
    @tiptap/extension-table-cell @tiptap/extension-table-header \
    @tiptap/extension-character-count
```

## 扩展建议

### 1. Markdown 导入

使用 `@tiptap/extension-markdown` 实现完整的 Markdown 双向转换。

### 2. 协作编辑

集成 Yjs 和 `@tiptap/extension-collaboration` 实现多人协作。

### 3. 图片上传

添加 `@tiptap/extension-image` 支持图片插入和上传。

### 4. 导出功能

- 导出为 PDF
- 导出为 HTML
- 导出为 Word 文档

### 5. 模板系统

创建脚本模板库，快速初始化常用文档格式。

## 注意事项

1. **性能优化**
   - 大文档建议使用分页或虚拟滚动
   - 自动保存防抖避免频繁请求
   - 本地缓存减少网络开销

2. **数据安全**
   - 定期备份版本历史
   - 客户端加密敏感内容
   - 实现权限控制

3. **兼容性**
   - Tiptap JSON 格式可能随版本变化
   - 建议保留 Markdown 作为后备格式
   - 版本升级时做好迁移测试

## 文件清单

### 类型定义
- `web/src/app/(user)/canvas/script-types.ts`
- `web/src/app/(user)/canvas/types.ts` (已更新)

### 数据库
- `web/src/lib/server/database/migrations/002_create_canvas_script_tables.up.sql`
- `web/src/lib/server/database/migrations/002_create_canvas_script_tables.down.sql`
- `web/src/lib/server/database/canvas-script-migration.ts`

### 服务层
- `web/src/lib/server/canvas-script-service.ts`

### API 路由
- `web/src/app/api/canvas/[projectId]/scripts/route.ts`
- `web/src/app/api/canvas/[projectId]/scripts/[scriptId]/route.ts`
- `web/src/app/api/canvas/[projectId]/scripts/[scriptId]/versions/route.ts`
- `web/src/app/api/canvas/[projectId]/scripts/[scriptId]/versions/[revision]/route.ts`
- `web/src/app/api/canvas/[projectId]/scripts/[scriptId]/restore/route.ts`

### 组件
- `web/src/app/(user)/canvas/components/canvas-script-tiptap-editor.tsx`
- `web/src/app/(user)/canvas/components/canvas-script-node.tsx`
- `web/src/app/(user)/canvas/components/canvas-script-node-wrapper.tsx`

### 工具函数
- `web/src/app/(user)/canvas/utils/canvas-script-markdown.ts`
- `web/src/app/(user)/canvas/utils/canvas-script-storage.ts`

### 文档
- `docs/canvas-script-node-guide.md` (本文件)

## 总结

Canvas Script 节点提供了完整的富文本编辑解决方案，参考 Drawing 节点的实现模式，具备以下特点：

- ✅ 完整的 CRUD API
- ✅ 版本历史管理
- ✅ 自动保存和本地缓存
- ✅ Markdown 导出
- ✅ 实时统计
- ✅ Tiptap 富文本编辑
- ✅ 与 Drawing 节点一致的架构

后续可根据实际需求扩展协作编辑、模板系统、高级导出等功能。
