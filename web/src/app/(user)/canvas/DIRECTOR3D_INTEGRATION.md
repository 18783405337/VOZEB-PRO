# 3D导演台功能集成清单

## 已完成的核心文件 ✅

### 数据库层
- [x] `web/src/lib/server/database/migrations/003_create_canvas_director3d_tables.up.sql`
- [x] `web/src/lib/server/database/migrations/003_create_canvas_director3d_tables.down.sql`

### 后端服务层
- [x] `web/src/lib/server/canvas-director3d-service.ts`

### API路由
- [x] `web/src/app/api/canvas/[projectId]/director3d/scenes/route.ts`
- [x] `web/src/app/api/canvas/[projectId]/director3d/scenes/[sceneId]/route.ts`

### 类型定义
- [x] `web/src/app/(user)/canvas/types.ts` (已更新)
- [x] `web/src/app/(user)/canvas/types-director3d.ts` (新增)
- [x] `web/src/app/(user)/canvas/constants.ts` (已更新)

### 工具函数
- [x] `web/src/app/(user)/canvas/utils/canvas-director3d-utils.ts`

### React组件
- [x] `web/src/app/(user)/canvas/components/canvas-director3d-node.tsx`
- [x] `web/src/app/(user)/canvas/components/canvas-director3d-viewer.tsx`

### 文档
- [x] `web/src/app/(user)/canvas/DIRECTOR3D_README.md`
- [x] `web/src/app/(user)/canvas/DIRECTOR3D_INTEGRATION.md` (本文件)

## 待集成步骤 🔧

### 1. 数据库迁移
```bash
# 连接数据库并运行迁移
psql $DATABASE_URL -f web/src/lib/server/database/migrations/003_create_canvas_director3d_tables.up.sql

# 验证表已创建
psql $DATABASE_URL -c "\dt canvas_director3d*"
```

### 2. 更新画布节点渲染器

在 `web/src/app/(user)/canvas/components/canvas-node.tsx` 中添加:

```tsx
import { CanvasDirector3DNode } from "./canvas-director3d-node";

// 在节点渲染逻辑中添加
function renderNodeContent(node: CanvasNodeData) {
    switch (node.type) {
        // ... 其他节点类型
        case CanvasNodeType.Director3D:
            return (
                <CanvasDirector3DNode
                    node={node}
                    isSelected={selectedNodeIds.includes(node.id)}
                    onUpdate={(metadata) => handleNodeUpdate(node.id, metadata)}
                />
            );
        // ... 其他节点类型
    }
}
```

### 3. 添加节点创建菜单项

在画布右键菜单或工具栏中添加"3D导演台"选项:

```tsx
// 在 canvas-context-menu.tsx 或类似文件中
{
    label: "3D导演台",
    icon: "🎬",
    onClick: () => createNode(CanvasNodeType.Director3D, { x, y })
}
```

### 4. 安装Three.js (可选但推荐)

```bash
cd web
pnpm add three
pnpm add -D @types/three
```

更新 `next.config.js`:
```js
const nextConfig = {
    // ... 现有配置
    transpilePackages: [...existingPackages, 'three'],
};
```

### 5. 测试流程

1. **创建节点**
   - 在画布上创建一个3D导演台节点
   - 验证节点显示正常

2. **编辑场景**
   - 点击"编辑"按钮
   - 尝试添加相机和光源
   - 保存场景

3. **API测试**
   ```bash
   # 获取场景列表
   curl -X GET http://localhost:3000/api/canvas/{projectId}/director3d/scenes
   
   # 创建场景
   curl -X POST http://localhost:3000/api/canvas/{projectId}/director3d/scenes \
     -H "Content-Type: application/json" \
     -d '{"sceneId":"test-scene","snapshot":{...}}'
   ```

4. **数据库验证**
   ```sql
   SELECT * FROM canvas_director3d_scenes LIMIT 5;
   ```

## 当前限制 ⚠️

1. **3D渲染**: 当前使用Canvas 2D占位实现，显示基本信息而非真实3D场景
2. **模型导入**: 接口已就绪但功能未实现
3. **高级光照**: 仅支持基础光源类型
4. **性能优化**: 未实现渲染节流和资源管理

## 快速启动 (无Three.js)

即使没有安装Three.js，框架也可以正常工作：

1. 运行数据库迁移
2. 集成到画布节点渲染器
3. 添加创建菜单项
4. 重启开发服务器

节点将显示为占位视图，显示场景基本信息。

## 完整Three.js集成步骤

### Step 1: 安装依赖
```bash
pnpm add three
pnpm add -D @types/three
```

### Step 2: 创建Three.js场景管理器
创建 `web/src/app/(user)/canvas/utils/canvas-director3d-three.ts`:

```typescript
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class ThreeSceneManager {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;

    constructor(canvas: HTMLCanvasElement, width: number, height: number) {
        // 初始化场景
        this.scene = new THREE.Scene();
        
        // 初始化相机
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        
        // 初始化渲染器
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(width, height);
        
        // 初始化控制器
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
    }

    public render() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    public dispose() {
        this.controls.dispose();
        this.renderer.dispose();
    }
}
```

### Step 3: 更新Viewer组件
替换 `canvas-director3d-viewer.tsx` 中的占位实现为真实Three.js渲染。

## 故障排除

### 问题: 数据库表不存在
**解决**: 运行迁移脚本
```bash
psql $DATABASE_URL -f web/src/lib/server/database/migrations/003_create_canvas_director3d_tables.up.sql
```

### 问题: API返回401未授权
**解决**: 确保用户已登录，检查session中间件

### 问题: 组件不显示
**解决**: 
1. 检查是否已在 `canvas-node.tsx` 中添加渲染逻辑
2. 验证 `CanvasNodeType.Director3D` 已正确添加到types
3. 检查浏览器控制台错误

### 问题: WebGL不可用
**解决**: 
- 检查浏览器是否支持WebGL
- 尝试在chrome://flags中启用WebGL
- 组件会自动显示降级UI

## 性能监控

建议监控以下指标：

1. **渲染性能**: FPS应保持在30+
2. **内存使用**: 每个场景应<100MB
3. **加载时间**: 初始加载<2秒
4. **Bundle大小**: Three.js增加~600KB (gzipped)

## 进一步优化建议

1. **按需加载**: 仅在首次创建3D节点时加载Three.js
2. **实例复用**: 多个节点共享Three.js资源
3. **LOD**: 为复杂模型实现细节层次
4. **Web Worker**: 将模型解析移到worker线程
5. **CDN**: 考虑从CDN加载Three.js

## 联系与支持

如有问题，请查看:
- `DIRECTOR3D_README.md` - 详细功能说明
- Three.js官方文档
- 项目issue tracker

---

**最后更新**: 2026-08-14
**功能状态**: MVP框架完成，Three.js集成待完成
