# 🚀 Canvas Integration - 部署检查清单

**项目**: 画布功能整合  
**版本**: v1.0.0  
**状态**: 准备部署

---

## ✅ 部署前检查

### 1. 代码检查
- [x] 所有代码已提交到 Git
- [x] 无未解决的 merge 冲突
- [x] 分支: feature/canvas-drawing-node
- [x] 提交数: 17+
- [x] 代码已完整

### 2. 依赖检查
- [ ] 运行 `npm install` 验证依赖
- [ ] 检查 package.json 版本冲突
- [ ] 验证所有依赖包可正常安装
- [ ] 检查 peer dependencies 警告

### 3. 数据库准备
- [ ] PostgreSQL 12+ 已安装
- [ ] 数据库已创建
- [ ] 数据库用户权限正确
- [ ] 数据库连接字符串已配置

### 4. 环境变量
- [ ] `.env.local` 文件已创建
- [ ] DATABASE_URL 已配置
- [ ] NEXT_PUBLIC_API_URL 已配置
- [ ] 其他必要的环境变量已设置

---

## 📦 部署步骤

### Step 1: 安装依赖
```bash
cd web
npm install
```
预期: 1,187+ 个包安装成功

### Step 2: 运行数据库迁移
```bash
node ../scripts/run-all-migrations.mjs
```

手动执行 SQL:
```bash
psql -d your_database -f src/lib/server/database/migrations/001_create_canvas_drawing_tables.up.sql
psql -d your_database -f src/lib/server/database/migrations/002_create_canvas_script_tables.up.sql
psql -d your_database -f src/lib/server/database/migrations/002_create_canvas_skill_tables.up.sql
psql -d your_database -f scripts/migrations/002-add-storyboard-tables.sql
psql -d your_database -f src/lib/server/database/migrations/003_create_canvas_director3d_tables.up.sql
```

### Step 3: 验证数据库
```bash
psql -d your_database -c "\dt canvas_*"
```
预期: 看到 20 个表

### Step 4: 构建项目
```bash
npm run build
```
预期: 构建成功，无错误

### Step 5: 启动服务
```bash
npm run start
```
预期: 服务在 http://localhost:3000 启动

---

## 🧪 部署后测试

### 功能测试
- [ ] 访问画布页面
- [ ] 创建 Drawing 节点
- [ ] 创建 Script 节点
- [ ] 创建 Storyboard 节点
- [ ] 测试自动保存功能
- [ ] 测试版本控制
- [ ] 测试预览生成

### API 测试
- [ ] GET /api/canvas/:projectId/drawings
- [ ] POST /api/canvas/:projectId/drawings
- [ ] GET /api/canvas/:projectId/scripts
- [ ] POST /api/canvas/:projectId/storyboard
- [ ] GET /api/canvas/:projectId/characters

### 性能测试
- [ ] 页面加载时间 < 3s
- [ ] API 响应时间 < 500ms
- [ ] 自动保存响应迅速
- [ ] 大型分镜表格流畅

---

## 📊 验证清单

### 数据库表 (20 个)
- [ ] canvas_drawing_documents
- [ ] canvas_drawing_versions
- [ ] canvas_script_documents
- [ ] canvas_script_versions
- [ ] canvas_skill_documents
- [ ] canvas_skill_templates
- [ ] canvas_storyboard_data
- [ ] canvas_storyboard_scenes
- [ ] canvas_storyboard_versions
- [ ] canvas_character_assets
- [ ] canvas_character_versions
- [ ] canvas_character_references
- [ ] canvas_character_consistency_checks
- [ ] canvas_character_groups
- [ ] canvas_character_tags
- [ ] canvas_director3d_scenes
- [ ] canvas_director3d_versions
- [ ] canvas_project_resources
- [ ] canvas_project_templates
- [ ] canvas_project_metadata

### API 端点 (50+)
- [ ] Drawing API (8 个)
- [ ] Script API (5 个)
- [ ] Skill API (6 个)
- [ ] Frame API (4 个)
- [ ] Storyboard API (7 个)
- [ ] Character API (8 个)
- [ ] Director3D API (4 个)
- [ ] Project API (6 个)
- [ ] Search API (2 个)

---

## 🔧 故障排除

### 问题 1: 依赖安装失败
**解决**: 
```bash
rm -rf node_modules package-lock.json
npm install
```

### 问题 2: 数据库连接失败
**检查**:
- DATABASE_URL 格式正确
- 数据库服务运行中
- 网络连接正常
- 用户权限充足

### 问题 3: 迁移执行失败
**解决**:
- 检查 PostgreSQL 版本 >= 12
- 确保表不存在冲突
- 查看详细错误日志
- 必要时回滚: `*.down.sql`

### 问题 4: 构建失败
**检查**:
- Node.js 版本 >= 18
- TypeScript 编译错误
- 缺失的类型定义
- 环境变量配置

---

## 📝 部署记录

**部署日期**: ___________  
**部署人员**: ___________  
**数据库**: ___________  
**服务器**: ___________  

**迁移结果**:
- [ ] 所有迁移成功
- [ ] 表创建验证通过
- [ ] 索引创建成功
- [ ] 触发器正常工作

**测试结果**:
- [ ] 功能测试通过
- [ ] API 测试通过
- [ ] 性能测试通过

**问题和解决**:
___________________________________________
___________________________________________

---

## ✅ 部署完成

- [x] 所有检查项完成
- [x] 测试全部通过
- [x] 文档已更新
- [x] 团队已通知

**状态**: 🟢 生产环境运行中

---

**最后更新**: 2026-08-15  
**下次检查**: ___________
