# 画布功能整合分析报告

## 项目概况

### 当前项目 (VOZEB-PRO)
- **技术栈**: Next.js 16 + React 19 + TypeScript + Ant Design
- **架构**: 服务端渲染 (SSR) + API Routes
- **状态管理**: Zustand
- **画布特点**: 
  - 集成在 `/canvas` 路由下
  - 支持多项目管理
  - 与后端 PostgreSQL 深度集成
  - 强大的 Agent 协作能力
  - 支持全景图 (Panorama)
  - 品牌工具包 (Brand Kit)

### 目标项目 (open-ai-canvas)
- **技术栈**: Vite + React 19 + TypeScript + Ant Design
- **架构**: 纯前端 SPA + Go 后端
- **状态管理**: Zustand + LocalForage
- **画布特点**:
  - 专注于 AI 影视与短剧创作
  - 支持绘图编辑器 (Excalidraw, Tldraw)
  - 结构化分镜脚本系统
  - 角色卡与角色管理
  - 3D 导演台
  - 技能系统 (Skills)
  - 项目关联功能

## 核心差异对比

### 1. 节点类型 (CanvasNodeType)

| 当前项目 | 目标项目 | 说明 |
|---------|---------|------|
| Image | Image | 图片节点 ✓ |
| Panorama | - | 全景图节点 |
| Text | Text | 文本节点 ✓ |
| Config | Config | 配置节点 ✓ |
| Video | Video | 视频节点 ✓ |
| Audio | Audio | 音频节点 ✓ |
| Brief | - | 简报节点 |
| Task | - | 任务节点 |
| BrandKit | - | 品牌工具包 |
| - | Drawing | 绘图节点 ⭐ |
| - | Script | 脚本节点 ⭐ |
| - | Skill | 技能节点 ⭐ |
| - | Frame | 框架节点 ⭐ |

### 2. 关键功能差异

#### 目标项目独有功能 (需要整合)

1. **绘图编辑器系统**
   - 支持 Excalidraw 和 Tldraw 两种绘图引擎
   - 绘图文档独立存储和版本控制
   - 绘图预览和生成渲染
   - 文件位置: 
     - `web/src/components/canvas/canvas-drawing-*.tsx`
     - `web/src/lib/canvas/canvas-drawing-storage.ts`

2. **结构化分镜脚本系统**
   - 详细的分镜表格 (StoryboardData)
   - 包含 17+ 列信息（镜头号、时长、情节描述、对白、镜头尺寸、情绪、灯光、运镜等）
   - 角色引用系统
   - 批量生成功能
   - 文件位置:
     - `web/src/pages/canvas/use-canvas-storyboard.ts`
     - `web/src/components/canvas/canvas-storyboard-*.tsx`

3. **技能系统 (Skills)**
   - 自定义 AI 技能模板
   - 技能分类（写作、分镜、图片、视频、工具）
   - 技能快照和版本管理
   - 文件位置:
     - `web/src/pages/skills/`
     - `web/src/types/canvas.ts` (CanvasSkillSnapshot)

4. **角色管理系统**
   - 角色卡片 (Character Reference)
   - 角色资产和版本控制
   - 角色在分镜中的引用
   - 文件位置:
     - `web/src/components/canvas/canvas-character-reference-*.tsx`

5. **3D 导演台 (Director)**
   - Three.js 集成
   - 相机控制和预览
   - 文件位置:
     - `web/src/pages/canvas/use-canvas-director.ts`

6. **项目关联功能**
   - 画布可关联到项目 (Short Drama Project)
   - 项目管理页面独立
   - 文件位置:
     - `web/src/pages/projects/`

7. **批量生成系统**
   - 支持分镜图片批量生成
   - 支持分镜视频批量生成
   - 批量任务状态追踪
   - 文件位置:
     - `web/src/pages/canvas/use-canvas-generation-batches.ts`

8. **视频编辑操作**
   - 多种视频编辑操作类型
   - 视频延伸、修复、元素替换、运镜等
   - 文件位置:
     - `web/src/types/canvas.ts` (CanvasVideoEditOperation)

9. **字幕和时间线系统**
   - SRT 字幕支持
   - 字幕高亮和样式
   - 时间线编辑
   - 文件位置:
     - `web/src/types/timeline.ts`

#### 当前项目独有功能 (需要保留)

1. **全景图支持**
   - Panorama 节点类型
   - Photo Sphere Viewer 集成
   - 等距柱状投影

2. **品牌工具包**
   - BrandKit 节点类型
   - 品牌风格定义
   - 视觉关键词和配色

3. **Agent 系统**
   - Agent 运行状态追踪
   - Agent 任务依赖管理
   - Agent 协作面板

4. **相机控制**
   - 详细的相机参数
   - 镜头、焦距、光圈控制

## 整合策略

### 阶段一：核心节点类型扩展 (优先级: 高)

1. **添加 Drawing 节点支持**
   - 整合 Excalidraw 和 Tldraw 库
   - 创建绘图存储系统
   - 实现绘图编辑器模态框
   - 预估工作量: 5-7 天

2. **添加 Script 节点支持**
   - 实现脚本编辑器
   - 支持富文本编辑 (Tiptap)
   - 脚本导入导出
   - 预估工作量: 3-4 天

3. **添加 Skill 节点支持**
   - 创建技能系统
   - 技能模板管理
   - 技能执行引擎
   - 预估工作量: 4-5 天

4. **添加 Frame 节点支持**
   - 实现框架节点
   - 节点分组功能
   - 预估工作量: 2-3 天

### 阶段二：分镜脚本系统整合 (优先级: 高)

1. **StoryboardData 类型定义**
   - 扩展 CanvasNodeMetadata
   - 添加分镜表格数据结构
   - 预估工作量: 1-2 天

2. **分镜编辑器组件**
   - 可编辑表格组件
   - 列配置和可见性控制
   - 角色引用选择器
   - 预估工作量: 5-7 天

3. **批量生成功能**
   - 集成现有任务系统
   - 实现批量生成队列
   - 状态追踪和重试
   - 预估工作量: 4-5 天

### 阶段三：角色和资产管理 (优先级: 中)

1. **角色管理系统**
   - 角色卡数据模型
   - 角色资产存储
   - 角色版本管理
   - 预估工作量: 4-5 天

2. **角色引用系统**
   - 分镜中的角色引用
   - 角色一致性检查
   - 预估工作量: 2-3 天

### 阶段四：3D 和高级功能 (优先级: 中低)

1. **3D 导演台**
   - Three.js 集成
   - 相机预览和控制
   - 预估工作量: 5-7 天

2. **视频编辑增强**
   - 视频编辑操作类型
   - 时间线编辑器
   - 字幕系统
   - 预估工作量: 7-10 天

### 阶段五：项目关联功能 (优先级: 低)

1. **项目管理系统**
   - 短剧项目数据模型
   - 项目详情页面
   - 画布与项目关联
   - 预估工作量: 5-7 天

## 技术挑战和解决方案

### 1. 架构差异

**挑战**: 目标项目使用 Vite + React Router，当前项目使用 Next.js + App Router

**解决方案**:
- 将目标项目的 pages 组件改造为 Next.js 兼容格式
- 使用 `"use client"` 指令处理客户端组件
- 路由从 React Router 迁移到 Next.js 路由

### 2. 状态管理

**挑战**: 两个项目都使用 Zustand，但 store 结构不同

**解决方案**:
- 保留当前项目的 store 结构作为基础
- 扩展 store 以支持目标项目的功能
- 合并冲突的 store 方法

### 3. 依赖冲突

**挑战**: 
- Excalidraw 需要特定版本配置
- Tldraw 可能与现有依赖冲突
- Three.js 较大会增加打包体积

**解决方案**:
- 使用动态导入 (lazy loading) 加载重型库
- 配置 Next.js 的 transpilePackages
- 优化打包策略

### 4. 数据存储

**挑战**: 目标项目使用 LocalForage + Go 后端，当前项目使用 PostgreSQL

**解决方案**:
- 绘图文档可使用 LocalForage 作为缓存
- 在 PostgreSQL 中添加表存储绘图元数据
- 二进制绘图数据存储在对象存储

## 数据库 Schema 扩展建议

```sql
-- 绘图文档表
CREATE TABLE canvas_drawing_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    drawing_id TEXT NOT NULL,
    engine TEXT NOT NULL CHECK (engine IN ('excalidraw', 'tldraw')),
    snapshot JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    shape_count INTEGER DEFAULT 0,
    page_count INTEGER DEFAULT 1,
    preview_url TEXT,
    render_url TEXT,
    render_metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, drawing_id)
);

-- 角色资产表
CREATE TABLE canvas_character_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_node_id TEXT,
    image_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 角色版本表
CREATE TABLE canvas_character_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES canvas_character_assets(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    image_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 技能模板表
CREATE TABLE canvas_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    template TEXT NOT NULL,
    output_mode TEXT NOT NULL,
    output_contract TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    tags TEXT[],
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 批量生成任务表
CREATE TABLE canvas_generation_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    source_node_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## API 端点扩展建议

```typescript
// 绘图文档 API
POST   /api/canvas/:projectId/drawings
GET    /api/canvas/:projectId/drawings/:drawingId
PUT    /api/canvas/:projectId/drawings/:drawingId
DELETE /api/canvas/:projectId/drawings/:drawingId

// 角色资产 API
GET    /api/canvas/characters
POST   /api/canvas/characters
GET    /api/canvas/characters/:id
PUT    /api/canvas/characters/:id
DELETE /api/canvas/characters/:id
POST   /api/canvas/characters/:id/versions

// 技能 API
GET    /api/canvas/skills
POST   /api/canvas/skills
GET    /api/canvas/skills/:id
PUT    /api/canvas/skills/:id
DELETE /api/canvas/skills/:id

// 批量生成 API
POST   /api/canvas/:projectId/batches
GET    /api/canvas/:projectId/batches/:batchId
POST   /api/canvas/:projectId/batches/:batchId/cancel
POST   /api/canvas/:projectId/batches/:batchId/retry
```

## 总体工作量估算

| 阶段 | 功能 | 工作量 | 优先级 |
|-----|------|-------|-------|
| 阶段一 | 核心节点类型扩展 | 14-19 天 | 高 |
| 阶段二 | 分镜脚本系统整合 | 10-14 天 | 高 |
| 阶段三 | 角色和资产管理 | 6-8 天 | 中 |
| 阶段四 | 3D 和高级功能 | 12-17 天 | 中低 |
| 阶段五 | 项目关联功能 | 5-7 天 | 低 |
| **总计** | - | **47-65 天** | - |

## 风险评估

### 高风险

1. **依赖冲突**: Excalidraw 和 Tldraw 可能与现有依赖冲突
2. **性能影响**: Three.js 和绘图库会显著增加打包体积
3. **数据迁移**: 现有画布数据需要迁移到新结构

### 中风险

1. **API 兼容性**: 目标项目的 Go 后端 API 需要适配到当前项目
2. **UI 一致性**: 两个项目的 UI 风格需要统一
3. **测试覆盖**: 大量新功能需要完整的测试

### 低风险

1. **文档更新**: 需要更新用户文档和开发文档
2. **用户培训**: 新功能需要用户学习成本

## 建议实施路径

### 方案 A: 渐进式整合 (推荐)

1. **第 1-2 周**: 实施阶段一 - 核心节点类型扩展
   - 先实现 Drawing 节点，验证架构可行性
   - 添加必要的依赖和配置

2. **第 3-4 周**: 实施阶段二 - 分镜脚本系统
   - 在节点扩展基础上添加分镜功能
   - 集成批量生成系统

3. **第 5-6 周**: 实施阶段三 - 角色管理
   - 完善分镜系统的角色引用
   - 构建完整的工作流

4. **第 7+ 周**: 根据反馈决定是否实施阶段四和五

### 方案 B: 独立模块整合

1. 将目标项目作为独立子应用
2. 通过 iframe 或微前端方式集成
3. 数据通过 API 交互

**优点**: 减少架构冲突，开发速度快
**缺点**: 用户体验割裂，数据同步复杂

## 关键文件清单

### 需要移植的核心文件

```
目标项目 -> 当前项目

# 绘图系统
web/src/components/canvas/canvas-drawing-editor-modal.tsx
web/src/components/canvas/canvas-drawing-excalidraw-editor.tsx
web/src/components/canvas/canvas-drawing-tldraw-editor.tsx
web/src/lib/canvas/canvas-drawing-storage.ts

# 分镜系统
web/src/components/canvas/canvas-storyboard-*.tsx
web/src/pages/canvas/use-canvas-storyboard.ts
web/src/pages/canvas/use-canvas-generation-batches.ts

# 角色系统
web/src/components/canvas/canvas-character-reference-*.tsx
web/src/services/api/character-assets.ts

# 技能系统
web/src/pages/skills/
web/src/components/canvas/canvas-skill-*.tsx

# 3D 系统
web/src/pages/canvas/use-canvas-director.ts
web/src/components/canvas/canvas-director-*.tsx

# 类型定义
web/src/types/canvas.ts (部分)
web/src/types/timeline.ts
```

## 下一步行动

1. **技术验证** (1-2 天)
   - 在当前项目中验证 Excalidraw/Tldraw 集成
   - 测试 Three.js 集成和性能
   - 确认依赖兼容性

2. **详细设计** (2-3 天)
   - 完善数据库 schema
   - 设计 API 接口
   - 绘制组件架构图

3. **创建开发分支** (1 天)
   - 创建 feature/canvas-integration 分支
   - 设置开发环境
   - 准备测试数据

4. **开始实施阶段一** (2-3 周)
   - 按照渐进式整合方案执行
   - 持续集成和测试
   - 收集反馈并调整

## 结论

将 open-ai-canvas 整合到当前 VOZEB-PRO 项目是一个中等规模的工程，主要挑战在于：

1. **架构适配**: Vite/SPA 到 Next.js/SSR 的转换
2. **依赖管理**: 重型库的集成和优化
3. **功能完整性**: 保持两个项目的优势功能

建议采用**渐进式整合方案**，优先实现高价值功能（绘图、分镜），然后根据用户反馈决定后续功能的实施优先级。

整个项目预计需要 **2-3 个月**的开发时间（1-2 名全职开发者），加上 **1 个月**的测试和优化期。
