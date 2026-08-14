# 3D导演台功能 (Director 3D)

## 概述

3D导演台是一个用于可视化和预览3D场景的画布节点类型，支持相机、光源和3D模型的管理。

**当前状态**: MVP框架已完成，Three.js集成待完成

## 已实现的功能

### ✅ 后端 (Backend)

1. **数据库Schema**
   - `canvas_director3d_scenes` - 3D场景数据表
   - `canvas_director3d_versions` - 场景版本历史表
   - 迁移文件: `003_create_canvas_director3d_tables.up/down.sql`

2. **服务层**
   - `canvas-director3d-service.ts` - 场景CRUD操作
   - 支持版本历史管理
   - 支持预览图和缩略图存储

3. **API路由**
   - `GET /api/canvas/[projectId]/director3d/scenes` - 获取场景列表
   - `POST /api/canvas/[projectId]/director3d/scenes` - 创建场景
   - `GET /api/canvas/[projectId]/director3d/scenes/[sceneId]` - 获取单个场景
   - `PATCH /api/canvas/[projectId]/director3d/scenes/[sceneId]` - 更新场景
   - `DELETE /api/canvas/[projectId]/director3d/scenes/[sceneId]` - 删除场景

### ✅ 前端 (Frontend)

1. **类型定义**
   - `types-director3d.ts` - 完整的TypeScript类型定义
   - `Camera3D`, `Light3D`, `Model3D`, `Scene3DSnapshot` 等

2. **工具函数**
   - `canvas-director3d-utils.ts` - 场景操作工具函数
   - 向量计算、验证、导入导出等

3. **React组件**
   - `canvas-director3d-node.tsx` - 3D节点主组件
   - `canvas-director3d-viewer.tsx` - 3D场景查看器（占位实现）

4. **节点类型集成**
   - 已添加 `Director3D` 到 `CanvasNodeType` 枚举
   - 已添加到 `NODE_DEFAULT_SIZE` 配置
   - 已添加到节点元数据类型 `CanvasNodeMetadata`

## 待完成的任务

### 🔲 阶段1: Three.js基础集成 (估计: 2-3天)

1. **安装依赖**
   ```bash
   cd web
   pnpm add three
   pnpm add -D @types/three
   ```

2. **配置Next.js**
   更新 `next.config.js`:
   ```js
   transpilePackages: ['three'],
   ```

3. **实现Three.js场景渲染器**
   - 创建 `canvas-director3d-three-scene.ts`
   - 初始化 WebGL renderer
   - 实现场景、相机、光源的渲染
   - 添加 OrbitControls 支持

4. **更新Viewer组件**
   - 替换占位实现为真实Three.js渲染
   - 实现相机视角切换
   - 实现对象选择和高亮

### 🔲 阶段2: 相机可视化 (估计: 2-3天)

1. **相机视锥体渲染**
   - 绘制相机位置和视锥体
   - 实现FOV可视化
   - 添加视野范围指示器

2. **相机控制**
   - 位置调整（拖拽）
   - 目标点设置
   - FOV滑块控制
   - 相机切换

3. **相机预设**
   - 顶视图 (Top View)
   - 前视图 (Front View)
   - 侧视图 (Side View)
   - 透视图 (Perspective)

### 🔲 阶段3: 光源系统 (估计: 2天)

1. **光源类型实现**
   - ✅ 环境光 (Ambient Light)
   - ✅ 平行光 (Directional Light)
   - 点光源 (Point Light)
   - 聚光灯 (Spot Light)

2. **光源可视化**
   - 光源位置指示器
   - 光照方向箭头
   - 光照强度可视化

3. **光源控制**
   - 位置调整
   - 颜色选择器
   - 强度滑块
   - 阴影开关

### 🔲 阶段4: 模型导入 (估计: 3-4天)

1. **文件上传**
   - 支持 GLB/GLTF 格式
   - 文件大小限制 (建议 < 10MB)
   - 上传到对象存储

2. **模型加载**
   - GLTFLoader 集成
   - 加载进度显示
   - 错误处理

3. **模型操作**
   - 位置、旋转、缩放调整
   - 变换控制器 (TransformControls)
   - 材质预览

### 🔲 阶段5: 截图和导出 (估计: 1-2天)

1. **场景截图**
   - 渲染到canvas
   - 生成预览图和缩略图
   - 保存到对象存储

2. **场景导出**
   - 导出为JSON
   - 导出相机参数
   - 导出光照配置

### 🔲 阶段6: 性能优化 (估计: 2天)

1. **懒加载**
   - 动态导入Three.js
   - 按需加载模型
   - 组件级别代码分割

2. **渲染优化**
   - 限制FPS
   - 离屏时暂停渲染
   - LOD (Level of Detail)

3. **内存管理**
   - 正确释放Three.js资源
   - 纹理和几何体缓存
   - 场景切换时清理

## 开发指南

### 运行迁移

```bash
# 应用迁移
psql $DATABASE_URL < web/src/lib/server/database/migrations/003_create_canvas_director3d_tables.up.sql

# 回滚迁移
psql $DATABASE_URL < web/src/lib/server/database/migrations/003_create_canvas_director3d_tables.down.sql
```

### 集成到画布系统

在 `canvas-node.tsx` 中添加渲染逻辑:

```tsx
import { CanvasDirector3DNode } from "./canvas-director3d-node";

// 在节点渲染函数中
if (node.type === CanvasNodeType.Director3D) {
    return <CanvasDirector3DNode node={node} isSelected={isSelected} onUpdate={handleUpdate} />;
}
```

### 测试场景创建

```typescript
const testScene: Scene3DSnapshot = {
    cameras: [
        {
            id: "main-camera",
            name: "主相机",
            position: [5, 5, 5],
            target: [0, 0, 0],
            fov: 75,
            aspect: 4/3,
            near: 0.1,
            far: 1000
        }
    ],
    lights: [
        {
            id: "ambient",
            name: "环境光",
            type: "ambient",
            color: "#404040",
            intensity: 0.5
        },
        {
            id: "directional",
            name: "主光源",
            type: "directional",
            color: "#ffffff",
            intensity: 1.0,
            position: [10, 10, 10],
            direction: [-1, -1, -1]
        }
    ],
    models: [],
    environment: {
        backgroundColor: "#1a1a1a",
        gridVisible: true,
        axesVisible: true
    }
};
```

## 技术栈

- **3D引擎**: Three.js (待安装)
- **类型支持**: TypeScript + @types/three
- **框架**: React 19 + Next.js 16
- **样式**: TailwindCSS
- **数据库**: PostgreSQL

## 性能考虑

1. **Bundle大小**
   - Three.js gzipped ~600KB
   - 使用动态导入减少初始加载
   - 仅在需要时加载3D功能

2. **渲染性能**
   - 限制同时渲染的3D节点数量 (建议≤2)
   - 使用 `requestAnimationFrame` 控制帧率
   - 离屏节点暂停渲染

3. **内存使用**
   - 及时释放Three.js资源
   - 限制模型多边形数 (建议<50K)
   - 纹理尺寸限制 (建议≤2048x2048)

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

需要 WebGL 1.0+ 支持

## 文件结构

```
web/src/
├── app/(user)/canvas/
│   ├── types.ts                          # 更新：添加Director3D类型
│   ├── constants.ts                      # 更新：添加Director3D配置
│   ├── types-director3d.ts              # 新增：3D类型定义
│   ├── components/
│   │   ├── canvas-director3d-node.tsx   # 新增：主节点组件
│   │   └── canvas-director3d-viewer.tsx # 新增：3D查看器
│   └── utils/
│       └── canvas-director3d-utils.ts   # 新增：工具函数
├── lib/server/
│   ├── canvas-director3d-service.ts     # 新增：后端服务
│   └── database/migrations/
│       ├── 003_create_canvas_director3d_tables.up.sql    # 新增：迁移
│       └── 003_create_canvas_director3d_tables.down.sql  # 新增：回滚
└── app/api/canvas/[projectId]/director3d/
    ├── scenes/route.ts                   # 新增：场景列表API
    └── scenes/[sceneId]/route.ts         # 新增：单场景API
```

## 下一步

1. 安装Three.js依赖
2. 实现基础场景渲染
3. 添加相机控制
4. 集成到画布节点渲染系统
5. 测试和优化

## 参考资料

- [Three.js官方文档](https://threejs.org/docs/)
- [Three.js Examples](https://threejs.org/examples/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) (可选)
- [WebGL Fundamentals](https://webglfundamentals.org/)
