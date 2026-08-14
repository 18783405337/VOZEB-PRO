# 画布功能整合 - 快速启动指南

## 当前状态

✅ **阶段零 - 技术验证**: 环境已搭建，待测试

## 快速开始

### 1. 启动开发服务器

```bash
cd web
pnpm dev
```

### 2. 访问测试页面

打开浏览器访问：
```
http://localhost:3000/canvas-test
```

### 3. 进行测试

在测试页面上：
1. 点击 "Excalidraw 编辑器" 按钮
2. 等待编辑器加载（首次加载可能需要几秒）
3. 尝试绘制一些图形（矩形、圆形、线条）
4. 检查控制台是否有错误
5. 点击 "关闭编辑器"
6. 重复以上步骤测试 "Tldraw 编辑器"

### 4. 验证项目清单

- [ ] Excalidraw 编辑器能够正常加载
- [ ] Tldraw 编辑器能够正常加载  
- [ ] 可以绘制基本图形
- [ ] 工具栏功能正常
- [ ] 无控制台错误
- [ ] 页面响应流畅

## 已完成的工作

### ✅ 依赖安装
```json
{
  "@excalidraw/excalidraw": "0.18.1",
  "tldraw": "5.2.5"
}
```

### ✅ Next.js 配置更新
- 添加 `transpilePackages` 支持 ESM 库
- 配置动态导入避免 SSR 问题

### ✅ 测试页面创建
- `/canvas-test` - 主测试页面
- Excalidraw 测试组件
- Tldraw 测试组件

### ✅ 文档创建
- `CANVAS_INTEGRATION_ANALYSIS.md` - 详细分析报告
- `CANVAS_INTEGRATION_VERIFICATION.md` - 技术验证文档
- `CANVAS_INTEGRATION_PROGRESS.md` - 进度跟踪文档
- `CANVAS_INTEGRATION_QUICKSTART.md` - 本文档

## 技术架构

```
当前项目结构:
web/
├── src/
│   └── app/
│       └── (user)/
│           └── canvas-test/          # 新增测试页面
│               ├── page.tsx           # 主测试页面
│               ├── excalidraw-test.tsx  # Excalidraw 测试组件
│               └── tldraw-test.tsx    # Tldraw 测试组件
├── next.config.ts                  # 已更新配置
└── package.json                    # 已添加依赖
```

## 关键配置

### Next.js 配置 (next.config.ts)

```typescript
transpilePackages: ["@excalidraw/excalidraw", "tldraw"],
```

### 动态导入配置 (page.tsx)

```typescript
const ExcalidrawEditor = dynamic(
    () => import("./excalidraw-test").then((mod) => mod.ExcalidrawEditor),
    { ssr: false, loading: () => <div>加载中...</div> }
);
```

## 预期结果

### ✅ 成功标准
- 编辑器能够加载并显示
- 可以绘制和编辑图形
- 性能流畅，无明显延迟
- 控制台无 React 错误
- 打包体积增加可接受

### ❌ 失败情况
如果遇到以下问题，需要调整策略：
- React 19 兼容性错误
- SSR hydration 错误
- 依赖冲突
- 性能问题
- 打包体积过大

## 测试后的下一步

### 如果测试成功 ✅
1. 在 `CANVAS_INTEGRATION_VERIFICATION.md` 中记录测试结果
2. 更新 `CANVAS_INTEGRATION_PROGRESS.md` 中的任务状态
3. 创建开发分支: `feature/canvas-drawing-node`
4. 开始阶段一第一个任务: Drawing 节点实现

### 如果测试失败 ❌
1. 记录详细的错误信息
2. 分析失败原因
3. 尝试调整配置或版本
4. 如果无法解决，考虑替代方案
5. 重新评估整合策略

## 性能基准

测试后请记录：
- 页面首次加载时间: _____
- Excalidraw 加载时间: _____
- Tldraw 加载时间: _____
- 打包体积增加: _____
- 内存占用: _____

## 常见问题

### Q: 编辑器加载很慢
A: 这是正常的，首次加载需要下载较大的 JavaScript 包。使用动态导入可以避免影响主页面加载。

### Q: 控制台出现警告
A: 某些 peer dependency 警告是正常的。运行 `pnpm peers check` 查看详情。

### Q: SSR 错误
A: 确保使用了 `dynamic` 导入并设置 `ssr: false`。

### Q: 样式问题
A: Tldraw 需要导入 CSS: `import "tldraw/tldraw.css"`

## 相关资源

### 官方文档
- Excalidraw: https://docs.excalidraw.com/
- Tldraw: https://tldraw.dev/

### 示例项目
- Excalidraw Examples: https://github.com/excalidraw/excalidraw/tree/master/examples
- Tldraw Examples: https://github.com/tldraw/tldraw/tree/main/apps/examples

### 社区支持
- Excalidraw Discord
- Tldraw Discord

## 项目里程碑

- [x] **M0.1**: 依赖安装和配置 (2026-08-14)
- [x] **M0.2**: 测试页面创建 (2026-08-14)
- [ ] **M0.3**: 技术验证测试 (待进行)
- [ ] **M0.4**: 测试结果评估 (待进行)
- [ ] **M1.1**: Drawing 节点开发 (待开始)

## 联系信息

如有问题，请参考：
- 整合分析报告: `CANVAS_INTEGRATION_ANALYSIS.md`
- 进度跟踪: `CANVAS_INTEGRATION_PROGRESS.md`
- 技术验证: `CANVAS_INTEGRATION_VERIFICATION.md`

---

**准备好了吗？运行 `pnpm dev` 开始测试！** 🚀
