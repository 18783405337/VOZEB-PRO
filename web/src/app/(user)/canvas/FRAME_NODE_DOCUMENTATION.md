# Frame 节点功能文档

## 概述

Frame 节点是画布系统中用于组织和分组其他节点的容器组件。它提供了一种可视化的方式来组织相关内容，支持拖拽、调整大小和自定义样式。

## 功能特性

### 1. 基础功能
- **容器功能**: 作为其他节点的视觉容器
- **分组管理**: 自动跟踪包含的子节点
- **拖拽支持**: 支持拖拽移动整个框架及其内容
- **调整大小**: 可以手动调整框架大小
- **标题显示**: 可选的标题栏显示框架名称和子节点数量

### 2. 样式定制
- **8种预设颜色**: 蓝色、绿色、黄色、红色、紫色、粉色、灰色、橙色
- **背景透明度**: 可调节背景透明度
- **边框样式**: 2px 边框宽度，8px 圆角
- **标题样式**: 18px 字体大小，可自定义颜色

### 3. 交互功能
- **节点分组**: 拖动节点到框架内自动添加到分组
- **节点移除**: 拖动节点出框架自动从分组移除
- **批量移动**: 移动框架时子节点一起移动
- **自动调整**: 可选的自动调整大小以适应子节点

## 文件结构

```
web/src/app/(user)/canvas/
├── frame-types.ts                              # Frame 类型定义
├── constants.ts                                # 节点规格配置（已更新）
├── types.ts                                    # 画布类型定义（已更新）
├── components/
│   ├── canvas-frame-node-wrapper.tsx          # Frame 节点渲染组件
│   ├── canvas-frame-settings-panel.tsx        # Frame 设置面板
│   ├── canvas-node-content.tsx                # 节点内容渲染器（已更新）
│   └── canvas-toolbar.tsx                     # 工具栏（已更新）
└── utils/
    └── canvas-frame-utils.ts                  # Frame 工具函数
```

## 使用方法

### 1. 创建 Frame 节点

在画布工具栏中点击 "框架" 按钮，会在画布中心创建一个新的 Frame 节点。

```typescript
// 代码示例
createNode(CanvasNodeType.Frame);
```

### 2. 自定义 Frame

使用工具函数创建自定义 Frame：

```typescript
import { createFrameNode } from '../utils/canvas-frame-utils';

const frame = createFrameNode(
    { x: 100, y: 100 },
    projectId,
    {
        title: "我的框架",
        width: 800,
        height: 600,
        color: "purple"
    }
);
```

### 3. 管理子节点

```typescript
import {
    addNodeToFrame,
    removeNodeFromFrame,
    getFrameChildNodes,
    isNodeInsideFrame
} from '../utils/canvas-frame-utils';

// 添加节点到框架
const updatedFrame = addNodeToFrame(frame, nodeId);

// 从框架移除节点
const updatedFrame = removeNodeFromFrame(frame, nodeId);

// 获取框架内所有子节点
const children = getFrameChildNodes(frame, allNodes);

// 检查节点是否在框架内
const isInside = isNodeInsideFrame(node, frame);
```

### 4. 更新 Frame 属性

```typescript
import {
    updateFrameTitle,
    updateFrameColor,
    toggleFrameTitleVisibility
} from '../utils/canvas-frame-utils';

// 更新标题
const updatedFrame = updateFrameTitle(frame, "新标题");

// 更新颜色
const updatedFrame = updateFrameColor(frame, "red");

// 切换标题显示
const updatedFrame = toggleFrameTitleVisibility(frame);
```

## 数据结构

### CanvasFrameData

```typescript
type CanvasFrameData = {
    frameId: string;              // 框架唯一标识
    projectId: string;            // 所属项目ID
    title: string;                // 框架标题
    description?: string;         // 框架描述
    color?: string;               // 框架颜色
    backgroundOpacity?: number;   // 背景透明度
    showTitle?: boolean;          // 是否显示标题
    childNodeIds?: string[];      // 包含的节点ID列表
    createdAt: string;            // 创建时间
    updatedAt: string;            // 更新时间
};
```

### Frame 节点元数据

在 `CanvasNodeMetadata` 中添加的 Frame 相关字段：

```typescript
{
    frameId?: string;                  // Frame 唯一ID
    frameColor?: string;               // Frame 颜色
    frameBackgroundOpacity?: number;   // 背景透明度
    frameShowTitle?: boolean;          // 是否显示标题
    frameChildNodeIds?: string[];      // 子节点ID列表
}
```

## 预设颜色

Frame 提供 8 种预设颜色方案：

| 颜色键 | 中文名 | 边框颜色 | 背景颜色 |
|--------|--------|----------|----------|
| blue   | 蓝色   | #3b82f6  | #3b82f6  |
| green  | 绿色   | #10b981  | #10b981  |
| yellow | 黄色   | #f59e0b  | #f59e0b  |
| red    | 红色   | #ef4444  | #ef4444  |
| purple | 紫色   | #8b5cf6  | #8b5cf6  |
| pink   | 粉色   | #ec4899  | #ec4899  |
| gray   | 灰色   | #6b7280  | #6b7280  |
| orange | 橙色   | #f97316  | #f97316  |

## 默认配置

```typescript
const DEFAULT_FRAME_CONFIG = {
    resizable: true,        // 允许调整大小
    draggable: true,        // 允许拖动
    autoResize: false,      // 自动调整大小
    minWidth: 200,          // 最小宽度
    minHeight: 150,         // 最小高度
    padding: 20,            // 内边距
};

const DEFAULT_FRAME_STYLE = {
    borderColor: "#3b82f6",
    backgroundColor: "#3b82f6",
    backgroundOpacity: 0.05,
    borderWidth: 2,
    borderRadius: 8,
    titleFontSize: 18,
    titleColor: "#111827",
};
```

## 工具函数 API

### createFrameNode(position, projectId, options?)
创建新的 Frame 节点。

**参数:**
- `position: Position` - Frame 位置
- `projectId: string` - 项目 ID
- `options?: object` - 可选配置
  - `title?: string` - 标题
  - `width?: number` - 宽度
  - `height?: number` - 高度
  - `color?: string` - 颜色

**返回:** `CanvasNodeData`

### isNodeInsideFrame(node, frame)
检查节点是否完全在框架内。

**参数:**
- `node: CanvasNodeData` - 要检查的节点
- `frame: CanvasNodeData` - Frame 节点

**返回:** `boolean`

### isNodeOverlappingFrame(node, frame)
检查节点是否与框架有重叠。

**参数:**
- `node: CanvasNodeData` - 要检查的节点
- `frame: CanvasNodeData` - Frame 节点

**返回:** `boolean`

### addNodeToFrame(frame, nodeId)
将节点添加到框架。

**参数:**
- `frame: CanvasNodeData` - Frame 节点
- `nodeId: string` - 要添加的节点 ID

**返回:** `CanvasNodeData` - 更新后的 Frame

### removeNodeFromFrame(frame, nodeId)
从框架中移除节点。

**参数:**
- `frame: CanvasNodeData` - Frame 节点
- `nodeId: string` - 要移除的节点 ID

**返回:** `CanvasNodeData` - 更新后的 Frame

### autoResizeFrame(frame, childNodes)
自动调整框架大小以适应所有子节点。

**参数:**
- `frame: CanvasNodeData` - Frame 节点
- `childNodes: CanvasNodeData[]` - 子节点列表

**返回:** `CanvasNodeData` - 调整后的 Frame

### getFrameChildNodes(frame, allNodes)
获取框架内的所有子节点。

**参数:**
- `frame: CanvasNodeData` - Frame 节点
- `allNodes: CanvasNodeData[]` - 所有节点列表

**返回:** `CanvasNodeData[]` - 子节点列表

### updateFrameTitle(frame, title)
更新框架标题。

**参数:**
- `frame: CanvasNodeData` - Frame 节点
- `title: string` - 新标题

**返回:** `CanvasNodeData` - 更新后的 Frame

### updateFrameColor(frame, color)
更新框架颜色。

**参数:**
- `frame: CanvasNodeData` - Frame 节点
- `color: string` - 颜色键（如 "blue", "red"）

**返回:** `CanvasNodeData` - 更新后的 Frame

### toggleFrameTitleVisibility(frame)
切换框架标题显示状态。

**参数:**
- `frame: CanvasNodeData` - Frame 节点

**返回:** `CanvasNodeData` - 更新后的 Frame

## 技术细节

### 渲染机制

Frame 节点使用懒加载模式渲染：

```typescript
export function FrameNodeContent({ node, theme }: NodeContentRendererProps) {
    const CanvasFrameNodeWrapper = React.lazy(() =>
        import("./canvas-frame-node-wrapper").then((mod) => ({ 
            default: mod.CanvasFrameNodeWrapper 
        }))
    );

    return (
        <React.Suspense fallback={<LoadingFallback />}>
            <CanvasFrameNodeWrapper node={node} theme={theme} />
        </React.Suspense>
    );
}
```

### 样式计算

背景颜色使用 RGBA 格式以支持透明度：

```typescript
const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
```

## 未来扩展

以下功能可在未来版本中实现：

1. **数据库持久化**: 如需服务端持久化，可创建数据库 Schema 和 API 端点
2. **嵌套框架**: 支持框架内嵌套其他框架
3. **自动布局**: 自动排列框架内的节点
4. **导出功能**: 将框架及其内容导出为图片或 PDF
5. **模板系统**: 预定义的框架模板
6. **协作功能**: 多用户同时编辑框架
7. **锁定功能**: 锁定框架防止意外修改

## 注意事项

1. Frame 节点主要是前端功能，数据存储在画布状态中
2. 子节点的位置是相对于画布的绝对坐标，不是相对框架
3. 删除框架不会删除其中的子节点
4. Frame 节点不支持连接线（connections）
5. 标题区域占用约 40px 高度

## 示例场景

### 场景 1: 创作流程分组

```typescript
// 创建"灵感收集"框架
const inspirationFrame = createFrameNode(
    { x: 100, y: 100 },
    projectId,
    { title: "灵感收集", color: "purple", width: 800, height: 600 }
);

// 创建"最终作品"框架
const finalFrame = createFrameNode(
    { x: 1000, y: 100 },
    projectId,
    { title: "最终作品", color: "green", width: 600, height: 600 }
);
```

### 场景 2: 版本对比

```typescript
// 版本 A 框架
const versionA = createFrameNode(
    { x: 100, y: 100 },
    projectId,
    { title: "版本 A", color: "blue" }
);

// 版本 B 框架
const versionB = createFrameNode(
    { x: 800, y: 100 },
    projectId,
    { title: "版本 B", color: "red" }
);
```

## 相关文件

- **类型定义**: `frame-types.ts`
- **工具函数**: `utils/canvas-frame-utils.ts`
- **组件**: `components/canvas-frame-node-wrapper.tsx`, `components/canvas-frame-settings-panel.tsx`
- **配置**: `constants.ts`
- **主类型**: `types.ts`

## 版本历史

- **v1.0.0** (2026-08-14): 初始版本
  - 基础框架功能
  - 8 种预设颜色
  - 拖拽和调整大小支持
  - 子节点管理
  - 设置面板
