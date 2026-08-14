# Canvas Storyboard 分镜脚本系统

## 概述

Canvas Storyboard 是一个专业的分镜脚本管理系统，支持场景编排、镜头管理、时间轴编辑和批量生成功能。

## 功能特性

### 核心功能
- ✅ **场景管理** - 创建、编辑、删除场景，支持场景分组
- ✅ **镜头编辑** - 17+ 列的详细镜头信息编辑
- ✅ **表格编辑器** - 直观的表格界面，支持实时编辑
- ✅ **数据持久化** - LocalForage 本地缓存 + 服务器同步
- 🚧 **时间轴编辑** - 可视化时间轴，支持拖拽调整（待实现）
- 🚧 **批量生成** - 批量生成镜头图片/视频（待实现）
- 🚧 **角色引用** - 关联角色库（待实现）

### 镜头属性

每个镜头包含以下属性：

| 属性 | 类型 | 描述 |
|------|------|------|
| 镜号 | Number | 全局镜头序号 |
| 场次 | Number | 所属场景编号 |
| 缩略图 | Image | 镜头预览图 |
| 景别 | Select | 大远景/远景/全景/中景/近景/特写/过肩/双人 |
| 机位 | Select | 平视/俯视/仰视/顶视/荷兰角/主观视角 |
| 运镜 | Select | 静止/摇镜/倾斜/推拉/跟踪/升降/手持/变焦/斯坦尼康 |
| 画面描述 | Text | 镜头的视觉描述 |
| 视觉细节 | Text | 详细的视觉元素描述 |
| 对白 | Text | 角色对白内容 |
| 动作 | Text | 角色动作描述 |
| 音效 | Text | 音效说明 |
| 音乐 | Text | 背景音乐说明 |
| 时长 | Number | 镜头时长（秒） |
| 转场 | Select | 切/淡入淡出/叠化/划像/匹配剪辑 |
| 场地 | Text | 拍摄场地 |
| 时间 | Text | 拍摄时间（白天/夜晚等） |
| 状态 | Status | 草稿/待生成/生成中/已完成/失败/已通过/需修订 |
| 优先级 | Priority | 低/普通/高/关键 |
| 备注 | Text | 其他备注信息 |

## 文件结构

```
web/src/app/(user)/canvas/
├── storyboard-types.ts                    # 类型定义
├── components/
│   └── storyboard/
│       ├── canvas-storyboard-node.tsx            # 主节点组件
│       ├── canvas-storyboard-node-wrapper.tsx    # 节点包装器
│       ├── storyboard-table.tsx                  # 表格编辑器
│       ├── storyboard-scene-panel.tsx            # 场景面板
│       ├── storyboard-timeline.tsx               # 时间轴编辑器（待实现）
│       └── storyboard-batch-generation.tsx       # 批量生成（待实现）
└── utils/
    └── canvas-storyboard-storage.ts       # LocalForage 存储

web/src/app/api/canvas/[projectId]/
└── storyboard/
    ├── route.ts                           # POST 创建分镜
    ├── [storyboardId]/
    │   └── route.ts                       # GET/PUT/DELETE 分镜
    ├── scenes/
    │   └── route.ts                       # 场景管理（待实现）
    └── generate-batch/
        └── route.ts                       # 批量生成（待实现）

web/scripts/migrations/
└── 002-add-storyboard-tables.sql         # 数据库迁移脚本
```

## 数据模型

### StoryboardData
```typescript
{
  storyboardId: string;
  projectId: string;
  title: string;
  description?: string;
  scenes: StoryboardScene[];
  shots: StoryboardShot[];
  columnConfig?: StoryboardColumnConfig;
  timelineConfig?: TimelineConfig;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
```

### StoryboardScene
```typescript
{
  id: string;
  sceneNumber: number;
  title: string;
  description?: string;
  location?: string;
  timeOfDay?: string;
  weather?: string;
  mood?: string;
  color?: string;
  shotIds: string[];
  collapsed?: boolean;
  duration?: number;
  createdAt: string;
  updatedAt: string;
}
```

### StoryboardShot
```typescript
{
  id: string;
  sceneId: string;
  shotNumber: number;
  globalOrder: number;
  title?: string;
  description: string;
  visualDescription?: string;
  shotType: ShotType;
  cameraAngle: CameraAngle;
  cameraMovement: CameraMovement;
  duration: number;
  transition: TransitionType;
  dialogue?: string;
  action?: string;
  sound?: string;
  music?: string;
  imageUrl?: string;
  videoUrl?: string;
  status: ShotStatus;
  priority: ShotPriority;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

## 数据库 Schema

### canvas_storyboard
主表，存储分镜脚本的基本信息。

```sql
CREATE TABLE canvas_storyboard (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    storyboard_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    revision INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, storyboard_id)
);
```

### canvas_storyboard_scene
场景表，存储场景信息。

```sql
CREATE TABLE canvas_storyboard_scene (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL,
    scene_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    time_of_day TEXT,
    weather TEXT,
    mood TEXT,
    color TEXT,
    collapsed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES canvas_storyboard(storyboard_id) ON DELETE CASCADE
);
```

### canvas_storyboard_shot
镜头表，存储详细的镜头信息。

```sql
CREATE TABLE canvas_storyboard_shot (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    shot_number INTEGER NOT NULL,
    global_order INTEGER NOT NULL,
    title TEXT,
    description TEXT NOT NULL,
    visual_description TEXT,
    shot_type TEXT NOT NULL,
    camera_angle TEXT NOT NULL,
    camera_movement TEXT NOT NULL,
    duration REAL NOT NULL DEFAULT 3.0,
    transition TEXT NOT NULL DEFAULT 'cut',
    dialogue TEXT,
    action TEXT,
    sound TEXT,
    music TEXT,
    image_url TEXT,
    video_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    priority TEXT NOT NULL DEFAULT 'normal',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES canvas_storyboard(storyboard_id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES canvas_storyboard_scene(id) ON DELETE CASCADE
);
```

### canvas_storyboard_batch_task
批量生成任务表（待实现）。

```sql
CREATE TABLE canvas_storyboard_batch_task (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL,
    generation_type TEXT NOT NULL,
    model TEXT,
    shot_ids TEXT NOT NULL,
    config TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress_total INTEGER NOT NULL DEFAULT 0,
    progress_completed INTEGER NOT NULL DEFAULT 0,
    progress_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES canvas_storyboard(storyboard_id) ON DELETE CASCADE
);
```

## API 端点

### POST /api/canvas/:projectId/storyboard
创建新的分镜脚本。

**请求体：**
```json
{
  "storyboardId": "storyboard-xxx",
  "title": "新分镜脚本",
  "description": "项目描述",
  "scenes": [...],
  "shots": [...]
}
```

**响应：**
```json
{
  "code": 0,
  "message": "创建成功",
  "data": { ... }
}
```

### GET /api/canvas/:projectId/storyboard/:storyboardId
获取分镜脚本数据。

**响应：**
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "storyboardId": "storyboard-xxx",
    "projectId": "project-xxx",
    "title": "分镜脚本",
    "scenes": [...],
    "shots": [...],
    "revision": 1
  }
}
```

### PUT /api/canvas/:projectId/storyboard/:storyboardId
更新分镜脚本数据。

**请求体：**
```json
{
  "title": "更新的标题",
  "scenes": [...],
  "shots": [...],
  "revision": 1
}
```

### DELETE /api/canvas/:projectId/storyboard/:storyboardId
删除分镜脚本。

**响应：**
```json
{
  "code": 0,
  "message": "删除成功"
}
```

## 使用方法

### 1. 创建分镜节点

在画布上创建一个新的 Storyboard 节点：

```typescript
const storyboardNode = {
  id: "node-xxx",
  type: CanvasNodeType.Storyboard,
  title: "新分镜脚本",
  position: { x: 100, y: 100 },
  width: 800,
  height: 600,
  metadata: {
    status: "idle",
    storyboardId: "storyboard-xxx",
    storyboardRevision: 0,
    storyboardShotCount: 0,
    storyboardSceneCount: 0,
    storyboardTotalDuration: 0,
  },
};
```

### 2. 添加场景

点击左侧场景面板的"添加场景"按钮，或使用 API：

```typescript
const newScene = createDefaultScene(1);
```

### 3. 添加镜头

在场景面板中点击场景的"添加镜头"按钮：

```typescript
const newShot = createDefaultShot(sceneId, shotNumber, globalOrder);
```

### 4. 编辑镜头信息

在表格编辑器中直接编辑镜头的各个字段。数据会在 2 秒后自动保存。

### 5. 查看统计信息

头部工具栏显示：
- 场景数量
- 镜头数量
- 总时长

## 本地存储

分镜数据使用 LocalForage 在浏览器端缓存，提供离线编辑能力。

### 存储键格式
```
{projectId}:{storyboardId}
```

### API

```typescript
// 保存到本地
await saveStoryboardToLocal({ projectId, storyboardId }, data);

// 从本地加载
const data = await loadStoryboardFromLocal({ projectId, storyboardId });

// 删除本地数据
await deleteStoryboardFromLocal({ projectId, storyboardId });

// 列出项目的所有分镜
const keys = await listProjectStoryboards(projectId);
```

## 待实现功能

### 1. 时间轴编辑器
- [ ] 可视化时间轴渲染
- [ ] 镜头块拖拽
- [ ] 时长调整
- [ ] 播放头预览
- [ ] 缩放控制

### 2. 批量生成系统
- [ ] 选择镜头
- [ ] 配置生成参数
- [ ] 队列管理
- [ ] 进度追踪
- [ ] 错误处理

### 3. 高级功能
- [ ] 角色引用系统
- [ ] 场地库管理
- [ ] 模板系统
- [ ] 导出功能（PDF、Excel、Final Draft）
- [ ] 导入功能（从脚本生成分镜）
- [ ] 版本控制
- [ ] 协作编辑

### 4. 性能优化
- [ ] 虚拟滚动（大量镜头）
- [ ] 懒加载缩略图
- [ ] 增量保存
- [ ] 批量操作优化

## 技术栈

- **前端框架**: React 18 + Next.js 14
- **类型系统**: TypeScript
- **表格库**: 原生实现（可选 @tanstack/react-table）
- **时间轴**: 待定（可选 react-timeline-editor）
- **拖拽**: @dnd-kit（待实现）
- **本地存储**: LocalForage
- **状态管理**: React Hooks
- **样式**: Tailwind CSS

## 性能考虑

1. **大数据集处理**
   - 当镜头数量超过 100 时，考虑实现虚拟滚动
   - 缩略图懒加载

2. **自动保存**
   - 2 秒防抖延迟
   - 只保存变更的数据

3. **本地缓存**
   - 优先从 LocalForage 加载
   - 后台同步到服务器

## 最佳实践

1. **场景规划**
   - 建议一个场景包含 3-10 个镜头
   - 使用场景颜色标签进行分组

2. **镜头描述**
   - 画面描述：简洁的视觉要素
   - 视觉细节：具体的构图、灯光、色调等

3. **时长设置**
   - 参考标准：对话镜头 3-5 秒，动作镜头 2-3 秒
   - 总时长应与项目需求匹配

4. **状态管理**
   - 草稿 → 待生成 → 生成中 → 已完成 → 已通过
   - 使用优先级标记关键镜头

## 故障排除

### 数据未保存
- 检查浏览器控制台是否有错误
- 确认 LocalForage 未被禁用
- 检查网络连接

### 性能问题
- 减少同时显示的镜头数量
- 清理未使用的缩略图
- 考虑分场景编辑

### 同步问题
- 检查 API 端点是否正常
- 查看服务器日志
- 手动触发保存

## 更新日志

### v1.0.0 (2026-08-14)
- ✅ 初始版本
- ✅ 基础场景和镜头管理
- ✅ 表格编辑器
- ✅ LocalForage 存储
- ✅ API 端点框架
- ✅ 数据库 Schema

## 许可证

内部项目，保留所有权利。
