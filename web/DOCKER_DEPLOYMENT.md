# 🐳 Canvas Integration - Docker 部署指南

本指南将帮助你使用 Docker 在本地部署和测试画布功能整合项目。

---

## 📋 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB RAM
- 10GB 可用磁盘空间

---

## 🚀 快速开始

### 1. 进入项目目录

```bash
cd web
```

### 2. 启动所有服务

```bash
docker-compose up -d
```

这将启动：
- PostgreSQL 数据库（端口 5432）
- Next.js Web 应用（端口 3000）

### 3. 运行数据库迁移

```bash
docker-compose --profile migration run --rm migration
```

### 4. 查看服务状态

```bash
docker-compose ps
```

### 5. 访问应用

打开浏览器访问: http://localhost:3000

---

## 📦 详细步骤

### Step 1: 构建镜像

```bash
# 构建 Web 应用镜像
docker-compose build
```

预期输出：
```
[+] Building 120.5s (16/16) FINISHED
 => [internal] load build definition from Dockerfile
 => => transferring dockerfile: 654B
 ...
 => exporting to image
```

### Step 2: 启动数据库

```bash
# 仅启动数据库
docker-compose up -d postgres
```

验证数据库：
```bash
docker-compose exec postgres psql -U canvas_user -d canvas_db -c "\dt"
```

### Step 3: 运行迁移

创建所有表：

```bash
# 方法 1: 使用 Docker 容器运行迁移
docker-compose exec web sh -c "cd /app && node ../scripts/run-all-migrations.mjs"

# 方法 2: 手动执行 SQL
docker-compose exec postgres psql -U canvas_user -d canvas_db -f /app/src/lib/server/database/migrations/001_create_canvas_drawing_tables.up.sql
```

### Step 4: 启动 Web 应用

```bash
docker-compose up -d web
```

### Step 5: 查看日志

```bash
# 查看所有日志
docker-compose logs -f

# 仅查看 Web 应用日志
docker-compose logs -f web

# 仅查看数据库日志
docker-compose logs -f postgres
```

---

## 🧪 测试功能

### 1. 健康检查

```bash
# 检查 Web 应用
curl http://localhost:3000

# 检查数据库
docker-compose exec postgres pg_isready -U canvas_user
```

### 2. 数据库验证

```bash
# 连接到数据库
docker-compose exec postgres psql -U canvas_user -d canvas_db

# 列出所有表
\dt canvas_*

# 查看表结构
\d canvas_drawing_documents

# 退出
\q
```

预期看到 20 个表：
- canvas_drawing_documents
- canvas_drawing_versions
- canvas_script_documents
- canvas_script_versions
- ... 等

### 3. API 测试

```bash
# 测试 API 端点
curl http://localhost:3000/api/canvas/test-project-id/drawings

# 创建测试绘图
curl -X POST http://localhost:3000/api/canvas/test-project-id/drawings \
  -H "Content-Type: application/json" \
  -d '{
    "drawingId": "test-001",
    "engine": "tldraw",
    "snapshot": {},
    "shapeCount": 0,
    "pageCount": 1
  }'
```

---

## 🔧 常用命令

### 服务管理

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启服务
docker-compose restart

# 停止并删除所有数据
docker-compose down -v
```

### 查看状态

```bash
# 查看运行中的容器
docker-compose ps

# 查看资源使用
docker stats canvas-web canvas-postgres
```

### 进入容器

```bash
# 进入 Web 容器
docker-compose exec web sh

# 进入数据库容器
docker-compose exec postgres bash
```

### 数据库操作

```bash
# 备份数据库
docker-compose exec postgres pg_dump -U canvas_user canvas_db > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U canvas_user canvas_db < backup.sql
```

---

## 🐛 故障排除

### 问题 1: 端口被占用

**错误**: `Error: bind: address already in use`

**解决**:
```bash
# 查看占用端口的进程
lsof -i :3000
lsof -i :5432

# 修改端口（编辑 docker-compose.yml）
ports:
  - "3001:3000"  # Web 改为 3001
  - "5433:5432"  # 数据库改为 5433
```

### 问题 2: 数据库连接失败

**错误**: `connection refused`

**检查**:
```bash
# 查看数据库状态
docker-compose ps postgres

# 查看数据库日志
docker-compose logs postgres

# 测试连接
docker-compose exec postgres psql -U canvas_user -d canvas_db
```

### 问题 3: 构建失败

**错误**: `npm install failed`

**解决**:
```bash
# 清理并重新构建
docker-compose down
docker-compose build --no-cache
```

### 问题 4: 迁移失败

**错误**: `relation already exists`

**解决**:
```bash
# 重置数据库
docker-compose down -v
docker-compose up -d postgres
# 等待数据库就绪后重新运行迁移
```

---

## 📊 性能监控

### 查看资源使用

```bash
# 实时监控
docker stats

# 查看容器资源限制
docker-compose config
```

### 数据库性能

```bash
# 连接数
docker-compose exec postgres psql -U canvas_user -d canvas_db -c "SELECT count(*) FROM pg_stat_activity;"

# 数据库大小
docker-compose exec postgres psql -U canvas_user -d canvas_db -c "SELECT pg_size_pretty(pg_database_size('canvas_db'));"
```

---

## 🔒 安全建议

### 生产环境配置

1. **更改默认密码**:
```yaml
environment:
  POSTGRES_PASSWORD: your-strong-password-here
```

2. **使用环境变量文件**:
```bash
# 创建 .env 文件
cp .env.example .env
# 编辑 .env 设置敏感信息
```

3. **限制网络访问**:
```yaml
ports:
  - "127.0.0.1:5432:5432"  # 只允许本地访问
```

---

## 📝 开发模式

### 热重载开发

```yaml
# docker-compose.dev.yml
services:
  web:
    build:
      target: base  # 使用开发阶段
    volumes:
      - ./src:/app/src  # 挂载源代码
      - ./public:/app/public
    command: npm run dev
```

启动开发模式：
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## ✅ 部署检查清单

### 启动前
- [ ] Docker 和 Docker Compose 已安装
- [ ] 端口 3000 和 5432 可用
- [ ] 至少 4GB RAM 可用
- [ ] 10GB 磁盘空间可用

### 启动后
- [ ] 数据库容器运行中
- [ ] Web 容器运行中
- [ ] 数据库健康检查通过
- [ ] 20 个表创建成功
- [ ] Web 应用可访问
- [ ] API 端点响应正常

### 功能测试
- [ ] 可以访问画布页面
- [ ] 可以创建各种节点
- [ ] 自动保存功能正常
- [ ] 数据持久化正常

---

## 🎯 下一步

部署成功后，你可以：

1. **测试所有节点类型**
   - Drawing, Script, Skill
   - Frame, Storyboard, Character
   - Director3D, Brief, Task, BrandKit

2. **验证核心功能**
   - 自动保存
   - 版本控制
   - 预览生成
   - 批量操作

3. **性能测试**
   - 创建大量节点
   - 测试并发请求
   - 监控资源使用

4. **准备生产部署**
   - 配置反向代理（Nginx）
   - 设置 SSL 证书
   - 配置备份策略

---

## 📞 获取帮助

如果遇到问题：

1. 查看日志: `docker-compose logs`
2. 检查状态: `docker-compose ps`
3. 参考文档: `/docs` 目录
4. 故障排除: 本文档的故障排除章节

---

**祝部署顺利！** 🚀
