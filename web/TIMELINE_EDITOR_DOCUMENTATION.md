# 时间轴编辑器实现文档

## 概述

时间轴编辑器是一个专业的视频分镜序列编辑工具，支持可视化展示、交互式编辑、实时预览和多格式导出。

## 架构设计

### 核心组件结构

```
timeline/
├── timeline-editor.tsx          # 主编辑器容器
├── timeline-container.tsx       # 时间轴容器
├── timeline-controls.tsx        # 播放控制栏
├── timeline-ruler.tsx           # 时间标尺
├── timeline-track.tsx           # 视频轨道
├── timeline-audio-track.tsx     # 音频轨道
├── timeline-subtitle-track.tsx  # 字幕轨道
├── timeline-shot-block.tsx      # 镜头块组件
├── timeline-playhead.tsx        # 播放头
├── timeline-markers.tsx         # 场景标记
├── timeline-preview.tsx         # 预览面板
├── timeline-export-dialog.tsx   # 导出对话框
├── timeline-types.ts            # 类型定义
├── timeline-utils.ts            # 工具函数
├── timeline-export.ts           # 导出功能
└── index.ts                     # 导出入口
```

## 功能特性

### 1. 时间轴可视化

#### 多轨道视图
- **视频轨道**: 显示所有镜头的时间块，颜色标识生成状态
- **音频轨道**: 显示对白和旁白的音频分布
- **字幕轨道**: 显示字幕时间线
- **标记轨道**: 场景转换和关键节点标记

#### 时间标尺
- 支持多种缩放级别（10%-200%）
- 主刻度和次刻度自动适应缩放
- 时间格式化显示（MM:SS 或 HH:MM:SS）

#### 视觉状态编码
- 🟢 绿色：已生成视频
- 🔵 蓝色：已生成分镜
- 🟡 黄色：生成中/队列中
- 🔴 红色：生成失败
- ⚪ 灰色：未生成

### 2. 交互式编辑

#### 拖拽操作
```typescript
// 移动镜头块 - 调整顺序
handleDragStart(shotId, "move", startX)

// 调整时长 - 拖拽右边缘
handleDragStart(shotId, "resize-end", startX)

// 调整起始 - 拖拽左边缘
handleDragStart(shotId, "resize-start", startX)
```

#### 选择操作
- 单击：选中单个镜头
- Ctrl/Cmd+点击：多选镜头
- Shift+点击：范围选择
- 框选：拖拽选择区域（计划中）

#### 吸附功能
```typescript
// 自动对齐到网格或其他镜头边界
const snappedTime = snapToGrid(newStartTime, zoomLevel.minorInterval);
```

### 3. 播放控制

#### 基础控制
- ▶️ 播放/暂停
- ⏮️ 快退5秒
- ⏭️ 快进5秒
- 🔁 循环播放
- 拖拽进度条跳转

#### 播放速度
- 1x：正常速度
- 1.5x：1.5倍速
- 2x：2倍速

#### 实现原理
```typescript
// 60fps播放循环
useEffect(() => {
  if (!isPlaying) return;
  
  const interval = setInterval(() => {
    setCurrentTime((prev) => {
      const next = prev + (0.016 * playbackRate);
      if (next >= duration) {
        return loop ? 0 : duration;
      }
      return next;
    });
  }, 16);
  
  return () => clearInterval(interval);
}, [isPlaying, duration, loop, playbackRate]);
```

### 4. 预览功能

#### 内容预览
- 视频预览：播放生成的视频
- 分镜预览：显示分镜图像
- 文本预览：显示镜头描述和提示词
- 状态预览：显示生成进度

#### 预览同步
```typescript
// 根据时间轴当前时间查找对应镜头
const currentShot = useMemo(() => {
  return findShotAtTime(shots, currentTime);
}, [shots, currentTime]);
```

#### 视频控制
- 音量控制
- 全屏播放
- 时间同步

### 5. 导出功能

#### 支持格式

##### JSON 导出
```json
{
  "project": {
    "id": "project-id",
    "title": "项目标题",
    "style": "风格描述"
  },
  "shots": [
    {
      "order": 1,
      "title": "镜头标题",
      "startTime": 0,
      "duration": 5,
      "description": "镜头描述",
      "videoUrl": "https://..."
    }
  ]
}
```

##### CSV 导出
```csv
顺序,标题,开始时间,时长,描述,对白,状态
1,"开场镜头","0s","5s","描述文本","对白内容","已生成"
```

##### SRT 字幕导出
```srt
1
00:00:00,000 --> 00:00:05,000
这是第一句对白

2
00:00:05,000 --> 00:00:10,000
[旁白] 这是旁白内容
```

##### PDF 导出（计划中）
- 完整分镜脚本文档
- 包含缩略图和详细信息
- 打印友好格式

## 使用方法

### 基础集成

```typescript
import { TimelineEditor } from "./components/timeline";

function DramaEditorPage() {
  const { project, episode } = useDramaData();
  
  return (
    <TimelineEditor
      project={project}
      episode={episode}
      onUpdateShot={handleUpdateShot}
      onReorderShots={handleReorderShots}
      onSelectShot={handleSelectShot}
    />
  );
}
```

### 自定义配置

```typescript
// 自定义缩放级别
const customZoomLevels: TimelineZoomLevel[] = [
  { pixelsPerSecond: 50, label: "50%", majorInterval: 5, minorInterval: 1 },
  { pixelsPerSecond: 100, label: "100%", majorInterval: 2, minorInterval: 0.5 },
];

// 自定义标记
const sceneMarkers: TimelineMarker[] = [
  { id: "m1", time: 0, label: "开场", type: "scene" },
  { id: "m2", time: 30, label: "转场", type: "transition" },
];
```

## 性能优化

### 虚拟化渲染
```typescript
// 仅渲染可见区域的镜头块
const visibleShots = useMemo(() => {
  const viewportStart = scrollLeft / pixelsPerSecond;
  const viewportEnd = viewportStart + (viewportWidth / pixelsPerSecond);
  
  return shots.filter(shot => {
    const shotStart = startTimes.get(shot.id) || 0;
    const shotEnd = shotStart + shot.duration;
    return shotEnd > viewportStart && shotStart < viewportEnd;
  });
}, [shots, scrollLeft, pixelsPerSecond, viewportWidth]);
```

### 缓存计算
```typescript
// 缓存镜头起始时间
const startTimes = useMemo(() => 
  calculateShotStartTimes(shots), 
  [shots]
);

// 缓存场景颜色
const sceneColors = useMemo(() => 
  generateSceneColors(sceneIds), 
  [sceneIds]
);
```

### 防抖优化
```typescript
// 拖拽时使用节流避免频繁更新
const throttledUpdate = useMemo(
  () => throttle(onUpdateShot, 100),
  [onUpdateShot]
);
```

## 工具函数

### 时间计算

```typescript
// 计算总时长
function calculateTotalDuration(shots: DramaShot[]): number

// 计算每个镜头的起始时间
function calculateShotStartTimes(shots: DramaShot[]): Map<string, number>

// 查找指定时间的镜头
function findShotAtTime(shots: DramaShot[], time: number): DramaShot | null

// 时间格式化
function formatTime(seconds: number): string
```

### 坐标转换

```typescript
// 像素转时间
function pixelToTime(pixel: number, pixelsPerSecond: number): number

// 时间转像素
function timeToPixel(time: number, pixelsPerSecond: number): number

// 网格吸附
function snapToGrid(time: number, interval: number): number
```

### 颜色管理

```typescript
// 获取镜头颜色
function getShotColor(shot: DramaShot, sceneColors: Map<string, string>): string

// 生成场景颜色
function generateSceneColors(sceneIds: string[]): Map<string, string>
```

## 类型定义

```typescript
// 缩放级别
type TimelineZoomLevel = {
  pixelsPerSecond: number;
  label: string;
  majorInterval: number;
  minorInterval: number;
};

// 标记点
type TimelineMarker = {
  id: string;
  time: number;
  label: string;
  type: "scene" | "transition" | "keyframe";
  color?: string;
};

// 拖拽状态
type TimelineDragState = {
  type: "move" | "resize-start" | "resize-end" | "playhead";
  shotId?: string;
  startX: number;
  startTime: number;
  originalDuration?: number;
  originalOrder?: number;
};

// 播放状态
type TimelinePlaybackState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loop: boolean;
  playbackRate: 1 | 1.5 | 2;
};
```

## 键盘快捷键（计划中）

| 快捷键 | 功能 |
|--------|------|
| Space | 播放/暂停 |
| ← | 后退5秒 |
| → | 前进5秒 |
| ↑ | 增加播放速度 |
| ↓ | 降低播放速度 |
| + | 放大时间轴 |
| - | 缩小时间轴 |
| Delete | 删除选中镜头 |
| Ctrl+C | 复制选中镜头 |
| Ctrl+V | 粘贴镜头 |
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |

## 扩展功能（规划）

### 1. 高级编辑
- [ ] 多选批量编辑
- [ ] 镜头复制/粘贴
- [ ] 撤销/重做历史
- [ ] 关键帧动画编辑

### 2. 协作功能
- [ ] 实时协作编辑
- [ ] 评论和标注
- [ ] 版本历史
- [ ] 冲突解决

### 3. 音频处理
- [ ] 波形可视化
- [ ] 音频淡入淡出
- [ ] 音频混音
- [ ] 音频效果

### 4. 视频合成
- [ ] 实时视频拼接
- [ ] 转场效果
- [ ] 特效预设
- [ ] 在线渲染

### 5. 导出增强
- [ ] 视频序列导出
- [ ] EDL（编辑决策列表）
- [ ] Final Cut Pro XML
- [ ] Premiere Pro 项目文件

## 文件清单

### 已创建文件

1. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-types.ts**
   - 类型定义和常量

2. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-utils.ts**
   - 工具函数集合

3. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-playhead.tsx**
   - 播放头组件

4. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-shot-block.tsx**
   - 镜头块组件

5. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-ruler.tsx**
   - 时间标尺组件

6. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-track.tsx**
   - 视频轨道组件

7. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-controls.tsx**
   - 播放控制栏

8. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-container.tsx**
   - 时间轴容器（主逻辑）

9. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-preview.tsx**
   - 预览面板

10. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-export.ts**
    - 导出功能实现

11. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-export-dialog.tsx**
    - 导出对话框

12. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-editor.tsx**
    - 主编辑器组件

13. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-markers.tsx**
    - 场景标记组件

14. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-subtitle-track.tsx**
    - 字幕轨道组件

15. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\timeline-audio-track.tsx**
    - 音频轨道组件

16. **D:\homeWork\saas-api2\VOZEB-PRO\web\src\app\(user)\drama\[id]\components\timeline\index.ts**
    - 导出入口文件

## 技术栈

- **React 18**: 组件化开发
- **TypeScript**: 类型安全
- **Ant Design**: UI组件库
- **Lucide React**: 图标库
- **Canvas/SVG**: 可能的渲染优化

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 总结

时间轴编辑器已完成核心功能开发，包括：
- ✅ 多轨道可视化展示
- ✅ 拖拽编辑交互
- ✅ 播放控制和预览
- ✅ 多格式导出
- ✅ 音频和字幕轨道
- ✅ 场景标记系统

所有16个组件文件已创建完成，可以直接集成到现有的drama编辑页面中使用。
