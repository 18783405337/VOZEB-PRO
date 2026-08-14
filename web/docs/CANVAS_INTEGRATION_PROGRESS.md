# 画布功能整合 - 实施进度跟踪

## 项目信息

- **项目名称**: VOZEB-PRO Canvas Integration
- **开始日期**: 2026-08-14
- **预计完成**: 2026-10-14 (2个月)
- **当前阶段**: 技术验证
- **整体进度**: 5%

## 整合方案概览

采用**渐进式整合**策略，分5个阶段逐步整合 open-ai-canvas 的功能到当前项目。

| 阶段 | 功能模块 | 工作量 | 优先级 | 状态 |
|-----|---------|-------|-------|------|
| 阶段零 | 技术验证 | 2天 | 最高 | 🟡 进行中 |
| 阶段一 | 核心节点类型扩展 | 14-19天 | 高 | ⚪ 待开始 |
| 阶段二 | 分镜脚本系统 | 10-14天 | 高 | ⚪ 待开始 |
| 阶段三 | 角色和资产管理 | 6-8天 | 中 | ⚪ 待开始 |
| 阶段四 | 3D和高级功能 | 12-17天 | 中低 | ⚪ 待开始 |
| 阶段五 | 项目关联功能 | 5-7天 | 低 | ⚪ 待开始 |

## 阶段零：技术验证 (当前阶段)

### 目标
验证关键第三方库的兼容性和性能

### 任务清单

- [x] 安装 @excalidraw/excalidraw@0.18.1
- [x] 安装 tldraw@5.2.5
- [x] 配置 Next.js transpilePackages
- [x] 创建测试页面 /canvas-test
- [x] 创建 Excalidraw 测试组件
- [x] 创建 Tldraw 测试组件
- [x] 创建技术验证文档
- [ ] 启动开发服务器测试
- [ ] 验证 Excalidraw 功能
- [ ] 验证 Tldraw 功能
- [ ] 性能和打包体积测试
- [ ] 记录测试结果
- [ ] 决定是否继续下一阶段

### 验证标准

**成功标准**:
- ✅ 两个编辑器都能正常加载
- ✅ 无 React 19 兼容性错误
- ✅ 无 SSR hydration 错误
- ✅ 基本绘图功能正常
- ✅ 打包体积增加 < 5MB

**待测试项目**:
1. Excalidraw 编辑器加载
2. Tldraw 编辑器加载
3. 绘制基本图形
4. 撤销/重做功能
5. 控制台无错误
6. 页面加载时间

### 当前问题

_待测试后记录_

---

## 阶段一：核心节点类型扩展

### 目标
添加 Drawing, Script, Skill, Frame 四种新节点类型

### 任务分解

#### 1.1 Drawing 节点 (5-7天)

- [ ] 扩展 CanvasNodeType 枚举添加 "drawing"
- [ ] 创建 Drawing 节点数据模型
- [ ] 实现绘图文档存储系统 (LocalForage + PostgreSQL)
- [ ] 创建绘图编辑器模态框组件
- [ ] 集成 Excalidraw 引擎
- [ ] 集成 Tldraw 引擎
- [ ] 实现引擎切换功能
- [ ] 实现绘图预览生成
- [ ] 实现绘图导出功能
- [ ] 添加到画布创建菜单
- [ ] 编写单元测试
- [ ] 编写集成测试

**依赖文件**:
```
/tmp/open-ai-canvas/web/src/components/canvas/canvas-drawing-editor-modal.tsx
/tmp/open-ai-canvas/web/src/components/canvas/canvas-drawing-excalidraw-editor.tsx
/tmp/open-ai-canvas/web/src/components/canvas/canvas-drawing-tldraw-editor.tsx
/tmp/open-ai-canvas/web/src/lib/canvas/canvas-drawing-storage.ts
```

**数据库 Schema**:
```sql
CREATE TABLE canvas_drawing_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    drawing_id TEXT NOT NULL,
    engine TEXT NOT NULL CHECK (engine IN ('excalidraw', 'tldraw')),
    snapshot JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    preview_url TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    UNIQUE(project_id, drawing_id)
);
```

#### 1.2 Script 节点 (3-4天)

- [ ] 添加 "script" 节点类型
- [ ] 创建脚本编辑器组件
- [ ] 集成 Tiptap 富文本编辑器
- [ ] 实现脚本导入/导出
- [ ] 支持 Markdown 和富文本格式
- [ ] 添加到画布创建菜单
- [ ] 编写测试

**依赖**:
- @tiptap/react
- @tiptap/starter-kit
- @tiptap/extension-*

#### 1.3 Skill 节点 (4-5天)

- [ ] 添加 "skill" 节点类型
- [ ] 创建技能系统数据模型
- [ ] 实现技能模板管理
- [ ] 创建技能执行引擎
- [ ] 实现技能分类系统
- [ ] 创建技能选择器组件
- [ ] 添加到画布创建菜单
- [ ] 编写测试

**数据库 Schema**:
```sql
CREATE TABLE canvas_skills (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    template TEXT NOT NULL,
    output_mode TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL
);
```

#### 1.4 Frame 节点 (2-3天)

- [ ] 添加 "frame" 节点类型
- [ ] 实现框架节点渲染
- [ ] 实现节点分组功能
- [ ] 实现框架调整大小
- [ ] 添加到画布创建菜单
- [ ] 编写测试

---

## 阶段二：分镜脚本系统

### 目标
实现完整的结构化分镜脚本编辑和批量生成功能

### 任务分解

#### 2.1 分镜数据模型 (1-2天)

- [ ] 扩展 CanvasNodeMetadata 类型
- [ ] 定义 StoryboardData 类型
- [ ] 定义 StoryboardRow 类型
- [ ] 定义 StoryboardColumn 枚举
- [ ] 定义角色引用类型

#### 2.2 分镜编辑器组件 (5-7天)

- [ ] 创建分镜表格组件
- [ ] 实现可编辑单元格
- [ ] 实现列配置面板
- [ ] 实现列可见性控制
- [ ] 创建角色引用选择器
- [ ] 实现行添加/删除
- [ ] 实现行拖拽排序
- [ ] 实现数据验证
- [ ] 编写测试

#### 2.3 批量生成系统 (4-5天)

- [ ] 创建批量生成数据模型
- [ ] 实现批量生成队列
- [ ] 创建批量生成面板
- [ ] 实现状态追踪
- [ ] 实现失败重试
- [ ] 实现取消功能
- [ ] 集成现有任务系统
- [ ] 编写测试

**数据库 Schema**:
```sql
CREATE TABLE canvas_generation_batches (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    source_node_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

---

## 阶段三：角色和资产管理

### 目标
实现角色卡系统和角色资产管理

### 任务分解

#### 3.1 角色管理系统 (4-5天)

- [ ] 创建角色资产数据模型
- [ ] 创建角色版本数据模型
- [ ] 实现角色卡组件
- [ ] 实现角色列表页面
- [ ] 实现角色创建/编辑
- [ ] 实现角色版本管理
- [ ] 实现角色图片上传
- [ ] 编写测试

**数据库 Schema**:
```sql
CREATE TABLE canvas_character_assets (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE canvas_character_versions (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL,
    version INTEGER NOT NULL,
    image_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL
);
```

#### 3.2 角色引用系统 (2-3天)

- [ ] 实现分镜中的角色引用
- [ ] 创建角色选择器组件
- [ ] 实现角色一致性检查
- [ ] 实现角色引用高亮
- [ ] 编写测试

---

## 阶段四：3D和高级功能

### 目标
实现 3D 导演台、视频编辑增强和时间线系统

### 任务分解 (详细计划待定)

- [ ] 集成 Three.js
- [ ] 实现 3D 相机控制
- [ ] 视频编辑操作扩展
- [ ] 时间线编辑器
- [ ] 字幕系统

---

## 阶段五：项目关联功能

### 目标
实现画布与短剧项目的关联

### 任务分解 (详细计划待定)

- [ ] 创建项目管理数据模型
- [ ] 实现项目列表页面
- [ ] 实现项目详情页面
- [ ] 实现画布与项目关联
- [ ] 实现项目过滤功能

---

## 风险管理

### 高风险项

| 风险 | 影响 | 概率 | 缓解措施 | 负责人 |
|-----|-----|-----|---------|-------|
| 依赖冲突 | 高 | 中 | 技术验证阶段充分测试 | 开发团队 |
| 性能问题 | 高 | 中 | 动态导入、代码分割 | 开发团队 |
| React 19 兼容性 | 高 | 低 | 早期验证和测试 | 开发团队 |

### 中风险项

| 风险 | 影响 | 概率 | 缓解措施 | 负责人 |
|-----|-----|-----|---------|-------|
| API 适配复杂 | 中 | 中 | 渐进式迁移 | 后端团队 |
| UI 不一致 | 中 | 中 | 设计规范统一 | UI/UX |
| 数据迁移 | 中 | 低 | 兼容性设计 | 开发团队 |

---

## 里程碑

- **M0**: 技术验证完成 (2026-08-16) - 🟡 进行中
- **M1**: 核心节点类型完成 (2026-09-06) - ⚪ 待开始
- **M2**: 分镜系统完成 (2026-09-20) - ⚪ 待开始
- **M3**: 角色管理完成 (2026-09-30) - ⚪ 待开始
- **M4**: 高级功能完成 (2026-10-20) - ⚪ 待开始
- **M5**: 项目关联完成 (2026-10-31) - ⚪ 待开始

---

## 资源

### 开发文档
- [整合分析报告](../CANVAS_INTEGRATION_ANALYSIS.md)
- [技术验证报告](CANVAS_INTEGRATION_VERIFICATION.md)
- [数据库设计文档](待创建)
- [API 设计文档](待创建)

### 参考项目
- 目标项目: https://github.com/ddcat-ai/open-ai-canvas
- 当前项目: VOZEB-PRO

### 相关工具
- Excalidraw: https://excalidraw.com/
- Tldraw: https://tldraw.com/
- Tiptap: https://tiptap.dev/
- Three.js: https://threejs.org/

---

## 每日进度日志

### 2026-08-14
- ✅ 完成整合分析报告
- ✅ 安装绘图库依赖
- ✅ 配置 Next.js
- ✅ 创建测试页面
- ✅ 创建技术验证文档
- 🟡 待测试: 启动开发服务器验证

### 2026-08-15
_待更新_

---

## 下一步行动

### 立即行动 (今天)
1. ✅ 完成技术验证环境搭建
2. ⏳ 启动开发服务器进行实际测试
3. ⏳ 填写技术验证报告
4. ⏳ 决定是否继续阶段一

### 本周计划
1. 完成技术验证
2. 如果验证通过，开始阶段一：Drawing 节点
3. 创建详细的数据库设计文档
4. 创建详细的 API 设计文档

### 下周计划
1. 继续阶段一开发
2. 完成 Drawing 节点基本功能
3. 开始 Script 节点开发

---

## 团队沟通

### 需要决策的问题
- [ ] 技术验证通过后是否立即开始阶段一？
- [ ] 是否需要调整整合范围？
- [ ] 是否需要增加开发人力？

### 需要讨论的事项
- [ ] 数据库 Schema 设计评审
- [ ] API 接口设计评审
- [ ] UI/UX 设计统一标准

---

**最后更新**: 2026-08-14
**更新人**: Claude (Fable 5)
