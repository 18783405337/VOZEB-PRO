# Skill 节点快速开始指南

## 已创建的文件清单

### 1. 类型定义
✅ `/web/src/app/(user)/canvas/skill-types.ts`
- 技能分类、参数类型、模板定义
- 内置技能模板列表
- 辅助函数

### 2. 服务层
✅ `/web/src/lib/server/canvas-skill-service.ts`
- 技能文档 CRUD 操作
- 执行历史管理
- 统计信息查询

### 3. 数据库迁移
✅ `/web/src/lib/server/database/migrations/002_create_canvas_skill_tables.up.sql`
✅ `/web/src/lib/server/database/migrations/002_create_canvas_skill_tables.down.sql`
- canvas_skill_documents 表
- canvas_skill_execution_history 表
- 索引和触发器

### 4. 前端组件
✅ `/web/src/app/(user)/canvas/components/canvas-skill-node.tsx`
✅ `/web/src/app/(user)/canvas/components/canvas-skill-node-wrapper.tsx`
✅ `/web/src/app/(user)/canvas/components/canvas-skill-template-selector.tsx`
- 技能节点主组件
- 节点包装器
- 模板选择器

### 5. 工具类
✅ `/web/src/app/(user)/canvas/utils/canvas-skill-execution.ts`
✅ `/web/src/app/(user)/canvas/utils/canvas-skill-storage.ts`
- 技能执行引擎
- 本地存储管理

### 6. API 路由
✅ `/web/src/app/api/canvas/[projectId]/skills/route.ts`
✅ `/web/src/app/api/canvas/[projectId]/skills/[skillId]/route.ts`
✅ `/web/src/app/api/canvas/[projectId]/skills/[skillId]/execute/route.ts`
- 技能列表和创建
- 技能详情和更新
- 技能执行

### 7. 配置更新
✅ `/web/src/app/(user)/canvas/types.ts` (已更新)
- 添加 Skill 节点类型
- 添加技能相关元数据字段

✅ `/web/src/app/(user)/canvas/constants.ts` (已更新)
- 添加技能节点默认尺寸
- 添加技能节点规格

✅ `/web/src/app/(user)/canvas/components/canvas-node-content.tsx` (已更新)
- 添加 SkillNodeContent 渲染器
- 导入 Wand2 图标

### 8. 文档
✅ `/SKILL_NODE_IMPLEMENTATION.md`
- 完整的实现文档
- 架构说明和使用指南

## 下一步集成工作

### 1. 运行数据库迁移

```bash
# 执行迁移脚本创建技能表
psql -d your_database -f web/src/lib/server/database/migrations/002_create_canvas_skill_tables.up.sql
```

或者使用项目的迁移工具：
```bash
npm run migrate:up
```

### 2. 添加到画布创建菜单

在画布创建菜单组件中（通常在 `canvas-page-elements.tsx` 或类似文件）添加：

```tsx
import { Wand2 } from "lucide-react";

// 在创建菜单中添加
<ConnectionCreateOption 
    theme={theme} 
    icon={<Wand2 className="size-5" />} 
    title="技能节点" 
    description="执行预设技能和自动化任务" 
    onClick={() => onCreate(CanvasNodeType.Skill)} 
/>
```

### 3. 更新 CanvasCreatableNodeType

找到 `CanvasCreatableNodeType` 类型定义并添加 Skill：

```typescript
export type CanvasCreatableNodeType = 
    | CanvasNodeType.Image 
    | CanvasNodeType.Panorama 
    | CanvasNodeType.Text 
    | CanvasNodeType.Config 
    | CanvasNodeType.Video 
    | CanvasNodeType.Audio 
    | CanvasNodeType.Drawing
    | CanvasNodeType.Skill;  // 添加这一行
```

### 4. 测试基本功能

1. **创建节点**
   ```bash
   # 启动开发服务器
   npm run dev
   
   # 访问画布页面并创建 Skill 节点
   ```

2. **测试 API**
   ```bash
   # 创建技能文档
   curl -X POST http://localhost:3000/api/canvas/{projectId}/skills \
     -H "Content-Type: application/json" \
     -d '{
       "skillId": "test-skill-1",
       "templateId": "image-resize",
       "name": "调整图片大小",
       "parameters": {"width": 800, "height": 600}
     }'
   
   # 执行技能
   curl -X POST http://localhost:3000/api/canvas/{projectId}/skills/test-skill-1/execute \
     -H "Content-Type: application/json" \
     -d '{"parameters": {"width": 1920, "height": 1080}}'
   ```

## 验证检查清单

- [ ] 数据库表已创建（canvas_skill_documents, canvas_skill_execution_history）
- [ ] Skill 节点在创建菜单中可见
- [ ] 可以成功创建 Skill 节点
- [ ] 节点显示正确的初始状态
- [ ] 可以选择技能模板
- [ ] 可以配置技能参数
- [ ] 可以执行技能并看到进度
- [ ] 执行成功后显示结果
- [ ] 执行失败时显示错误信息
- [ ] 执行历史被正确记录
- [ ] 本地存储功能正常工作

## 内置技能模板测试

### 1. 图像调整大小 (image-resize)
```json
{
  "width": 1920,
  "height": 1080,
  "maintainAspectRatio": true
}
```

### 2. 图像滤镜 (image-filter)
```json
{
  "filter": "grayscale",
  "intensity": 75
}
```

### 3. 文本摘要 (text-summarize)
```json
{
  "maxLength": 200,
  "style": "concise"
}
```

### 4. 视频裁剪 (video-trim)
```json
{
  "startTime": 5,
  "endTime": 15
}
```

### 5. 音频标准化 (audio-normalize)
```json
{
  "targetDb": -14
}
```

## 常见问题

### Q: 技能节点不显示？
A: 检查 `canvas-node-content.tsx` 中是否正确导入和注册了 SkillNodeContent。

### Q: 执行技能时出错？
A: 检查：
1. API 端点是否正确配置
2. 数据库表是否已创建
3. 参数是否符合模板要求
4. 浏览器控制台是否有错误信息

### Q: 如何添加自定义技能？
A: 参考 `SKILL_NODE_IMPLEMENTATION.md` 中的"扩展性"章节。

### Q: 技能执行结果如何存储？
A: 执行结果存储在 `canvas_skill_documents` 表的 `output` 字段（JSONB），同时执行历史记录在 `canvas_skill_execution_history` 表中。

## 性能优化建议

1. **懒加载组件**: 已使用 React.lazy() 实现
2. **缓存模板列表**: 在前端缓存 BUILTIN_SKILL_TEMPLATES
3. **限流**: 对执行 API 实施速率限制
4. **异步处理**: 长时间运行的技能考虑使用队列系统

## 安全检查

- [x] API 端点有身份验证
- [x] 参数在服务端验证
- [x] SQL 注入防护（使用参数化查询）
- [x] XSS 防护（React 自动转义）
- [ ] 添加 CSRF 保护（如需要）
- [ ] 实施速率限制（如需要）

## 监控和日志

建议添加：
1. 技能执行时间监控
2. 失败率统计
3. 用户使用频率分析
4. 错误日志记录

## 部署前检查

- [ ] 所有 TypeScript 类型错误已解决
- [ ] 所有 ESLint 警告已处理
- [ ] 数据库迁移脚本已测试
- [ ] API 端点已测试
- [ ] 前端组件已测试
- [ ] 文档已更新
- [ ] 代码已提交到版本控制

## 支持的浏览器

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## 相关资源

- [Drawing 节点实现](web/src/app/(user)/canvas/components/canvas-drawing-node-wrapper.tsx)
- [Canvas 类型定义](web/src/app/(user)/canvas/types.ts)
- [数据库 Schema](web/src/lib/server/database/migrations/)

## 联系和反馈

如有问题或建议，请：
1. 查看 `SKILL_NODE_IMPLEMENTATION.md` 详细文档
2. 检查浏览器控制台错误
3. 查看服务器日志
4. 提交 Issue 或 Pull Request

---

**实现状态**: ✅ 核心功能完成，待集成测试

**最后更新**: 2026-08-14
