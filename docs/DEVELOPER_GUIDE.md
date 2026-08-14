# VOZEB PRO 开发者文档

本文档为 VOZEB PRO 项目的开发者提供详细的技术参考，包括架构设计、代码规范、开发流程和贡献指南。

## 目录

- [项目架构](#项目架构)
- [技术栈](#技术栈)
- [代码结构](#代码结构)
- [开发环境搭建](#开发环境搭建)
- [开发工作流](#开发工作流)
- [数据库设计](#数据库设计)
- [API 设计](#api-设计)
- [前端开发](#前端开发)
- [后端开发](#后端开发)
- [测试指南](#测试指南)
- [代码规范](#代码规范)
- [性能优化](#性能优化)
- [安全实践](#安全实践)
- [贡献指南](#贡献指南)

## 项目架构

### 整体架构

VOZEB PRO 采用全栈架构，基于 Next.js App Router：

```
┌─────────────────────────────────────────────────────────┐
│                      用户浏览器                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  React 前端  │  │  Canvas 编辑  │  │  媒体播放器  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│                    Nginx 反向代理                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    Next.js 应用层                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │              App Router (RSC)                     │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │  │
│  │  │ 用户端 │  │ 管理端 │  │ 公开页 │  │ API    │ │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │              业务服务层                           │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │  │
│  │  │ Agent  │  │ Canvas │  │ 生成   │  │ 计费   │ │  │
│  │  │ 服务   │  │ 服务   │  │ 服务   │  │ 服务   │ │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │              数据访问层                           │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │  │
│  │  │ User   │  │ Canvas │  │ Task   │  │ Order  │ │  │
│  │  │ Repo   │  │ Repo   │  │ Repo   │  │ Repo   │ │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │  文件存储    │  │  外部 AI API │
│  数据库      │  │  S3/Local    │  │  (OpenAI等)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 核心模块

1. **认证与授权**：Session 管理、权限控制
2. **Canvas 系统**：Drawing、Script、Skill 节点管理
3. **生成系统**：图片、视频、音频任务调度
4. **计费系统**：积分、订单、支付、退款
5. **素材管理**：上传、存储、引用追踪
6. **短剧生产**：剧本、分镜、合成流程

## 技术栈

### 前端

- **框架**：React 19 + Next.js 16 (App Router)
- **UI 库**：Ant Design 6 + Tailwind CSS 4
- **状态管理**：Zustand
- **Canvas 引擎**：Excalidraw、TLDraw
- **HTTP 客户端**：fetch + 类型化 API 客户端
- **表单**：React Hook Form（待集成）
- **动画**：Motion (Framer Motion)

### 后端

- **运行时**：Node.js 22
- **框架**：Next.js 16 (App Router + Route Handlers)
- **数据库**：PostgreSQL 16
- **数据库客户端**：pg (原生 SQL)
- **文件存储**：本地文件系统 / S3 兼容存储
- **视频处理**：FFmpeg（通过子进程）

### 开发工具

- **包管理器**：pnpm 10
- **TypeScript**：5.x
- **测试框架**：Vitest
- **E2E 测试**：Playwright
- **代码检查**：ESLint 9
- **代码格式化**：Prettier 3
- **Git Hooks**：Husky（可选）

### 基础设施

- **容器化**：Docker + Docker Compose
- **反向代理**：Nginx
- **SSL**：Let's Encrypt
- **监控**：自定义健康检查端点

## 代码结构

```
VOZEB-PRO/
├── web/                          # 主应用目录
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── (auth)/          # 认证相关页面
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   └── forgot-password/
│   │   │   ├── (public)/        # 公开页面
│   │   │   │   ├── gallery/
│   │   │   │   ├── share/
│   │   │   │   └── announcements/
│   │   │   ├── (workspace)/     # 用户工作区
│   │   │   │   ├── create/      # 统一 Agent
│   │   │   │   ├── image/       # 图片工作台
│   │   │   │   ├── video/       # 视频工作台
│   │   │   │   ├── canvas/      # Canvas 编辑器
│   │   │   │   ├── drama/       # 短剧制作
│   │   │   │   ├── assets/      # 素材管理
│   │   │   │   ├── prompts/     # 提示词库
│   │   │   │   ├── profile/     # 个人中心
│   │   │   │   └── billing/     # 充值中心
│   │   │   ├── admin/           # 管理后台
│   │   │   │   ├── dashboard/
│   │   │   │   ├── users/
│   │   │   │   ├── models/
│   │   │   │   ├── billing/
│   │   │   │   └── settings/
│   │   │   ├── api/             # API Route Handlers
│   │   │   │   ├── auth/
│   │   │   │   ├── canvas/
│   │   │   │   ├── image-tasks/
│   │   │   │   ├── video-tasks/
│   │   │   │   ├── billing/
│   │   │   │   └── admin/
│   │   │   ├── install/         # 安装向导
│   │   │   ├── layout.tsx       # 根布局
│   │   │   └── page.tsx         # 首页
│   │   ├── components/          # React 组件
│   │   │   ├── ui/              # 基础 UI 组件
│   │   │   ├── layout/          # 布局组件
│   │   │   ├── canvas/          # Canvas 相关组件
│   │   │   ├── workspace/       # 工作区组件
│   │   │   └── admin/           # 管理后台组件
│   │   ├── lib/
│   │   │   ├── server/          # 服务端代码
│   │   │   │   ├── database/    # 数据库层
│   │   │   │   │   ├── schema.ts
│   │   │   │   │   ├── repositories.ts
│   │   │   │   │   ├── canvas-*.ts
│   │   │   │   │   └── migrations/
│   │   │   │   ├── services/    # 业务服务
│   │   │   │   │   ├── agent-service.ts
│   │   │   │   │   ├── canvas-service.ts
│   │   │   │   │   ├── generation-service.ts
│   │   │   │   │   └── billing-service.ts
│   │   │   │   ├── auth/        # 认证授权
│   │   │   │   ├── storage/     # 存储服务
│   │   │   │   └── utils/       # 服务端工具
│   │   │   └── client/          # 客户端代码
│   │   │       └── utils/
│   │   ├── services/            # 前端 API 客户端
│   │   │   └── api/
│   │   ├── stores/              # 状态管理
│   │   │   ├── user-store.ts
│   │   │   ├── canvas-store.ts
│   │   │   └── theme-store.ts
│   │   ├── hooks/               # 自定义 Hooks
│   │   ├── types/               # TypeScript 类型
│   │   └── styles/              # 全局样式
│   ├── public/                  # 静态资源
│   ├── scripts/                 # 脚本工具
│   │   ├── run-migrations.mjs
│   │   ├── generation-worker.mjs
│   │   └── disaster-backup.mjs
│   ├── tests/                   # 测试文件
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── .env.example             # 环境变量模板
│   ├── next.config.mjs          # Next.js 配置
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── docs/                        # 文档站（独立项目）
├── scripts/                     # 根级脚本
├── .env.example                 # Docker 环境变量
├── docker-compose.yml           # Docker 配置
├── Dockerfile                   # Docker 镜像
├── README.md
└── CHANGELOG.md
```

## 开发环境搭建

### 必需软件

1. **Node.js 22**

```bash
# 使用 nvm（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22

# 验证版本
node --version  # v22.x.x
```

2. **pnpm 10**

```bash
npm install -g pnpm@latest
pnpm --version  # 10.x.x
```

3. **PostgreSQL 16**

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt-get install postgresql-16

# Windows
# 下载安装器：https://www.postgresql.org/download/windows/
```

4. **Git**

```bash
git --version  # 2.x+
```

5. **VS Code**（推荐）

安装扩展：
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense

### 克隆仓库

```bash
git clone https://github.com/18783405337/VOZEB-PRO.git
cd VOZEB-PRO
```

### 配置数据库

```bash
# 连接 PostgreSQL
psql postgres

# 创建数据库和用户
CREATE DATABASE vozeb_dev;
CREATE USER vozeb_dev_user WITH ENCRYPTED PASSWORD 'dev_password';
GRANT ALL PRIVILEGES ON DATABASE vozeb_dev TO vozeb_dev_user;

# 授予 schema 权限（PostgreSQL 15+）
\c vozeb_dev
GRANT ALL ON SCHEMA public TO vozeb_dev_user;

\q
```

### 配置环境变量

```bash
cd web
cp .env.example .env.local
nano .env.local
```

开发环境配置：

```env
# 站点 URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 数据库
DATABASE_URL=postgres://vozeb_dev_user:dev_password@localhost:5432/vozeb_dev

# 加密密钥
VOZEB_PRO_ENCRYPTION_KEY=dev_encryption_key_32_chars_long

# 安装令牌（可选，用于 /install）
VOZEB_PRO_INSTALL_TOKEN=dev_install_token

# 维护令牌
VOZEB_PRO_MAINTENANCE_TOKEN=dev_maintenance_token

# 数据目录
VOZEB_PRO_DATA_DIR=./data

# 开发模式
NODE_ENV=development
```

### 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 运行迁移

```bash
# 运行数据库迁移
node scripts/run-migrations.mjs up

# 检查迁移状态
node scripts/run-migrations.mjs status
```

### 启动开发服务器

```bash
pnpm run dev
```

访问 `http://localhost:3000`

### 初始化数据

访问 `http://localhost:3000/install` 完成初始化。

## 开发工作流

### 功能开发流程

1. **创建功能分支**

```bash
git checkout -b feature/canvas-export
```

2. **开发功能**

- 编写代码
- 添加测试
- 更新文档

3. **测试**

```bash
# 运行测试
pnpm test

# 类型检查
pnpm run typecheck

# 代码检查
pnpm run lint

# 格式检查
pnpm run format:check
```

4. **提交代码**

```bash
git add .
git commit -m "feat: add canvas export functionality"
```

提交信息格式：
- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式（不影响功能）
- `refactor:` 重构
- `test:` 测试相关
- `chore:` 构建过程或辅助工具

5. **推送分支**

```bash
git push origin feature/canvas-export
```

6. **创建 Pull Request**

- 描述变更内容
- 关联相关 Issue
- 请求 Code Review

7. **代码审查**

- 响应审查意见
- 修改代码
- 更新 PR

8. **合并到主分支**

审查通过后合并。

### 热重载

开发服务器支持热重载：

- React 组件更新：Fast Refresh
- API 路由更新：自动重启
- 配置文件更新：需要手动重启

### 调试

**VS Code 调试配置**

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

**浏览器 DevTools**

- React DevTools 扩展
- Network 面板查看 API 请求
- Console 查看日志

**服务端日志**

```typescript
// 服务端代码中
console.log('[DEBUG]', data);
console.error('[ERROR]', error);
```

## 数据库设计

### Canvas 相关表

**canvas_drawing_documents**

存储 Canvas 绘图文档：

```sql
CREATE TABLE canvas_drawing_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    drawing_id TEXT NOT NULL,
    engine TEXT NOT NULL,           -- 'excalidraw' | 'tldraw'
    snapshot JSONB NOT NULL,        -- 绘图数据
    revision INTEGER NOT NULL,      -- 版本号
    shape_count INTEGER,            -- 形状数量
    page_count INTEGER,             -- 页面数量
    preview_url TEXT,               -- 预览图 URL
    render_url TEXT,                -- 渲染图 URL
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(project_id, drawing_id)
);
```

**canvas_script_documents**

存储 Canvas 脚本文档：

```sql
CREATE TABLE canvas_script_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    script_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL,         -- 富文本内容
    markdown TEXT,                  -- Markdown 格式
    plain_text TEXT NOT NULL,       -- 纯文本（用于搜索）
    character_count INTEGER,        -- 字符数
    word_count INTEGER,             -- 单词数
    revision INTEGER NOT NULL,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(project_id, script_id)
);
```

**canvas_skill_documents**

存储 Canvas Skill 节点：

```sql
CREATE TABLE canvas_skill_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    skill_id TEXT NOT NULL,
    template_id TEXT NOT NULL,      -- Skill 模板 ID
    name TEXT NOT NULL,
    parameters JSONB NOT NULL,      -- 执行参数
    status TEXT NOT NULL,           -- 'idle' | 'running' | 'success' | 'error'
    progress INTEGER,               -- 0-100
    output JSONB,                   -- 执行结果
    error TEXT,                     -- 错误信息
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(project_id, skill_id)
);
```

### 版本历史表

**canvas_drawing_versions**

```sql
CREATE TABLE canvas_drawing_versions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES canvas_drawing_documents(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    description TEXT,
    shape_count INTEGER,
    page_count INTEGER,
    created_at TIMESTAMPTZ,
    UNIQUE(document_id, revision)
);
```

**canvas_script_versions**

```sql
CREATE TABLE canvas_script_versions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES canvas_script_documents(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    content JSONB NOT NULL,
    markdown TEXT,
    description TEXT,
    character_count INTEGER,
    word_count INTEGER,
    created_at TIMESTAMPTZ,
    UNIQUE(document_id, revision)
);
```

**canvas_skill_execution_history**

```sql
CREATE TABLE canvas_skill_execution_history (
    id UUID PRIMARY KEY,
    skill_document_id UUID NOT NULL REFERENCES canvas_skill_documents(id) ON DELETE CASCADE,
    status TEXT NOT NULL,           -- 'success' | 'error'
    parameters JSONB NOT NULL,
    output JSONB,
    error TEXT,
    execution_time_ms INTEGER,      -- 执行时间（毫秒）
    created_at TIMESTAMPTZ
);
```

### 索引策略

```sql
-- 主键索引自动创建
-- 外键索引
CREATE INDEX idx_canvas_drawing_documents_project_id ON canvas_drawing_documents(project_id);
CREATE INDEX idx_canvas_drawing_documents_user_id ON canvas_drawing_documents(user_id);
CREATE INDEX idx_canvas_script_documents_project_id ON canvas_script_documents(project_id);
CREATE INDEX idx_canvas_script_documents_user_id ON canvas_script_documents(user_id);
CREATE INDEX idx_canvas_skill_documents_project_id ON canvas_skill_documents(project_id);
CREATE INDEX idx_canvas_skill_documents_user_id ON canvas_skill_documents(user_id);

-- 时间索引（用于排序）
CREATE INDEX idx_canvas_drawing_documents_updated_at ON canvas_drawing_documents(updated_at DESC);
CREATE INDEX idx_canvas_script_documents_updated_at ON canvas_script_documents(updated_at DESC);

-- 全文搜索索引
CREATE INDEX idx_canvas_script_documents_plain_text ON canvas_script_documents USING gin(to_tsvector('english', plain_text));

-- 状态索引
CREATE INDEX idx_canvas_skill_documents_status ON canvas_skill_documents(status);
```

### Repository 模式

```typescript
// src/lib/server/database/canvas-drawing-repository.ts

export interface CanvasDrawingDocument {
    id: string;
    projectId: string;
    userId: string;
    drawingId: string;
    engine: 'excalidraw' | 'tldraw';
    snapshot: any;
    revision: number;
    shapeCount: number;
    pageCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export class CanvasDrawingRepository {
    /**
     * 创建或更新绘图文档
     */
    async upsert(data: {
        projectId: string;
        userId: string;
        drawingId: string;
        engine: string;
        snapshot: any;
        shapeCount?: number;
        pageCount?: number;
    }): Promise<CanvasDrawingDocument> {
        // 实现...
    }

    /**
     * 获取文档
     */
    async getByProjectAndDrawing(
        projectId: string,
        drawingId: string
    ): Promise<CanvasDrawingDocument | null> {
        // 实现...
    }

    /**
     * 保存版本历史
     */
    async saveVersion(
        documentId: string,
        revision: number,
        snapshot: any,
        description?: string
    ): Promise<void> {
        // 实现...
    }

    /**
     * 获取版本列表
     */
    async listVersions(
        documentId: string,
        limit: number = 10
    ): Promise<CanvasDrawingVersion[]> {
        // 实现...
    }
}
```

## API 设计

### RESTful 规范

- 使用 HTTP 动词：GET、POST、PUT/PATCH、DELETE
- 资源命名使用复数：`/api/users`、`/api/canvas/projects`
- 使用嵌套路由表达关系：`/api/canvas/projects/:id/drawings`
- 使用查询参数过滤：`/api/users?role=admin&status=active`
- 使用 HTTP 状态码：200、201、400、401、403、404、500

### 统一响应格式

```typescript
interface ApiResponse<T = any> {
    code: number;        // 业务状态码，0 表示成功
    data?: T;           // 响应数据
    msg?: string;       // 提示信息
    error?: string;     // 错误详情（开发环境）
}

// 成功响应
{
    code: 0,
    data: { id: "123", name: "Test" },
    msg: "操作成功"
}

// 错误响应
{
    code: 1001,
    msg: "用户名已存在"
}
```

### Canvas API 示例

**创建 Canvas 项目**

```typescript
// POST /api/canvas/projects
Request Body:
{
    name: string;
    description?: string;
}

Response:
{
    code: 0,
    data: {
        projectId: string;
        name: string;
        createdAt: string;
    }
}
```

**保存绘图数据**

```typescript
// POST /api/canvas/projects/:projectId/drawings
Request Body:
{
    drawingId: string;
    engine: 'excalidraw' | 'tldraw';
    snapshot: object;
}

Response:
{
    code: 0,
    data: {
        documentId: string;
        revision: number;
        updatedAt: string;
    }
}
```

**获取绘图数据**

```typescript
// GET /api/canvas/projects/:projectId/drawings/:drawingId

Response:
{
    code: 0,
    data: {
        id: string;
        drawingId: string;
        engine: string;
        snapshot: object;
        revision: number;
        shapeCount: number;
        updatedAt: string;
    }
}
```

### Route Handler 实现

```typescript
// src/app/api/canvas/projects/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { CanvasProjectRepository } from "@/lib/server/database/canvas-project-repository";

const repo = new CanvasProjectRepository();

/**
 * GET /api/canvas/projects
 * 获取用户的 Canvas 项目列表
 */
export async function GET(request: NextRequest) {
    try {
        // 验证用户登录
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json(
                { code: 401, msg: "未登录" },
                { status: 401 }
            );
        }

        // 获取查询参数
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "20");

        // 查询项目
        const result = await repo.listByUser(session.userId, {
            page,
            pageSize,
        });

        return NextResponse.json({
            code: 0,
            data: result,
        });
    } catch (error) {
        console.error("Failed to list canvas projects:", error);
        return NextResponse.json(
            { code: 500, msg: "服务器错误" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/canvas/projects
 * 创建新的 Canvas 项目
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession(request);
        if (!session) {
            return NextResponse.json(
                { code: 401, msg: "未登录" },
                { status: 401 }
            );
        }

        // 解析请求体
        const body = await request.json();
        const { name, description } = body;

        // 验证参数
        if (!name || name.length > 100) {
            return NextResponse.json(
                { code: 400, msg: "项目名称无效" },
                { status: 400 }
            );
        }

        // 创建项目
        const project = await repo.create({
            userId: session.userId,
            name,
            description,
        });

        return NextResponse.json({
            code: 0,
            data: project,
            msg: "创建成功",
        });
    } catch (error) {
        console.error("Failed to create canvas project:", error);
        return NextResponse.json(
            { code: 500, msg: "服务器错误" },
            { status: 500 }
        );
    }
}
```

## 前端开发

### 组件开发

**Canvas Drawing 组件示例**

```typescript
// src/components/canvas/CanvasDrawingEditor.tsx

'use client';

import { useState, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { canvasApi } from '@/services/api/canvas-api';

interface Props {
    projectId: string;
    drawingId: string;
}

export function CanvasDrawingEditor({ projectId, drawingId }: Props) {
    const [snapshot, setSnapshot] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // 加载绘图数据
    useEffect(() => {
        loadDrawing();
    }, [projectId, drawingId]);

    async function loadDrawing() {
        try {
            const response = await canvasApi.getDrawing(projectId, drawingId);
            if (response.code === 0) {
                setSnapshot(response.data.snapshot);
            }
        } catch (error) {
            console.error('Failed to load drawing:', error);
        } finally {
            setLoading(false);
        }
    }

    // 保存绘图数据
    async function handleSave(elements: any[], appState: any) {
        try {
            await canvasApi.saveDrawing(projectId, {
                drawingId,
                engine: 'excalidraw',
                snapshot: { elements, appState },
            });
        } catch (error) {
            console.error('Failed to save drawing:', error);
        }
    }

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div style={{ height: '100vh' }}>
            <Excalidraw
                initialData={snapshot}
                onChange={(elements, appState) => {
                    // 自动保存（节流）
                    debounce(() => handleSave(elements, appState), 2000);
                }}
            />
        </div>
    );
}
```

### 状态管理

```typescript
// src/stores/canvas-store.ts

import { create } from 'zustand';

interface CanvasStore {
    currentProjectId: string | null;
    projects: CanvasProject[];
    setCurrentProject: (id: string) => void;
    addProject: (project: CanvasProject) => void;
    removeProject: (id: string) => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
    currentProjectId: null,
    projects: [],
    
    setCurrentProject: (id) => set({ currentProjectId: id }),
    
    addProject: (project) =>
        set((state) => ({
            projects: [...state.projects, project],
        })),
    
    removeProject: (id) =>
        set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
        })),
}));
```

### API 客户端

```typescript
// src/services/api/canvas-api.ts

import { apiClient } from './api-client';

export const canvasApi = {
    /**
     * 获取项目列表
     */
    async listProjects(params?: { page?: number; pageSize?: number }) {
        return apiClient.get('/api/canvas/projects', { params });
    },

    /**
     * 创建项目
     */
    async createProject(data: { name: string; description?: string }) {
        return apiClient.post('/api/canvas/projects', data);
    },

    /**
     * 获取绘图数据
     */
    async getDrawing(projectId: string, drawingId: string) {
        return apiClient.get(
            `/api/canvas/projects/${projectId}/drawings/${drawingId}`
        );
    },

    /**
     * 保存绘图数据
     */
    async saveDrawing(
        projectId: string,
        data: {
            drawingId: string;
            engine: string;
            snapshot: any;
        }
    ) {
        return apiClient.post(
            `/api/canvas/projects/${projectId}/drawings`,
            data
        );
    },
};
```

## 后端开发

### 服务层设计

```typescript
// src/lib/server/services/canvas-service.ts

import { CanvasDrawingRepository } from '../database/canvas-drawing-repository';
import { CanvasScriptRepository } from '../database/canvas-script-repository';
import { CanvasSkillRepository } from '../database/canvas-skill-repository';

export class CanvasService {
    private drawingRepo = new CanvasDrawingRepository();
    private scriptRepo = new CanvasScriptRepository();
    private skillRepo = new CanvasSkillRepository();

    /**
     * 保存绘图文档
     */
    async saveDrawing(data: {
        projectId: string;
        userId: string;
        drawingId: string;
        engine: string;
        snapshot: any;
    }) {
        // 验证项目权限
        await this.validateProjectAccess(data.projectId, data.userId);

        // 计算统计信息
        const shapeCount = this.countShapes(data.snapshot);
        const pageCount = this.countPages(data.snapshot);

        // 保存文档
        const document = await this.drawingRepo.upsert({
            ...data,
            shapeCount,
            pageCount,
        });

        // 保存版本历史
        if (document.revision > 1) {
            await this.drawingRepo.saveVersion(
                document.id,
                document.revision,
                data.snapshot
            );
        }

        return document;
    }

    /**
     * 执行 Skill
     */
    async executeSkill(data: {
        projectId: string;
        userId: string;
        skillId: string;
        templateId: string;
        parameters: any;
    }) {
        // 验证权限
        await this.validateProjectAccess(data.projectId, data.userId);

        // 创建或更新 Skill 文档
        const skillDoc = await this.skillRepo.upsert({
            ...data,
            status: 'running',
            progress: 0,
        });

        // 异步执行（使用队列或 Worker）
        this.executeSkillAsync(skillDoc.id, data.templateId, data.parameters);

        return skillDoc;
    }

    /**
     * 异步执行 Skill
     */
    private async executeSkillAsync(
        skillDocId: string,
        templateId: string,
        parameters: any
    ) {
        const startTime = Date.now();

        try {
            // 根据模板执行不同逻辑
            const output = await this.runSkillTemplate(templateId, parameters);

            // 更新状态
            await this.skillRepo.update(skillDocId, {
                status: 'success',
                progress: 100,
                output,
                lastExecutedAt: new Date(),
            });

            // 记录执行历史
            await this.skillRepo.saveExecutionHistory({
                skillDocumentId: skillDocId,
                status: 'success',
                parameters,
                output,
                executionTimeMs: Date.now() - startTime,
            });
        } catch (error) {
            // 更新错误状态
            await this.skillRepo.update(skillDocId, {
                status: 'error',
                error: error.message,
                lastExecutedAt: new Date(),
            });

            // 记录失败历史
            await this.skillRepo.saveExecutionHistory({
                skillDocumentId: skillDocId,
                status: 'error',
                parameters,
                error: error.message,
                executionTimeMs: Date.now() - startTime,
            });
        }
    }

    private async runSkillTemplate(templateId: string, parameters: any) {
        // 根据不同模板执行不同逻辑
        switch (templateId) {
            case 'image-generator':
                return await this.generateImage(parameters);
            case 'text-generator':
                return await this.generateText(parameters);
            default:
                throw new Error(`Unknown template: ${templateId}`);
        }
    }

    private countShapes(snapshot: any): number {
        // 实现形状计数逻辑
        return snapshot?.elements?.length || 0;
    }

    private countPages(snapshot: any): number {
        // 实现页面计数逻辑
        return snapshot?.pages?.length || 1;
    }

    private async validateProjectAccess(projectId: string, userId: string) {
        // 验证用户是否有权访问该项目
        // 实现...
    }
}
```

## 测试指南

### 单元测试

```typescript
// src/lib/server/services/canvas-service.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { CanvasService } from './canvas-service';

describe('CanvasService', () => {
    let service: CanvasService;

    beforeEach(() => {
        service = new CanvasService();
    });

    describe('saveDrawing', () => {
        it('should save drawing document', async () => {
            const result = await service.saveDrawing({
                projectId: 'project-1',
                userId: 'user-1',
                drawingId: 'drawing-1',
                engine: 'excalidraw',
                snapshot: { elements: [] },
            });

            expect(result).toBeDefined();
            expect(result.revision).toBe(1);
        });

        it('should increment revision on update', async () => {
            // First save
            await service.saveDrawing({
                projectId: 'project-1',
                userId: 'user-1',
                drawingId: 'drawing-1',
                engine: 'excalidraw',
                snapshot: { elements: [] },
            });

            // Second save
            const result = await service.saveDrawing({
                projectId: 'project-1',
                userId: 'user-1',
                drawingId: 'drawing-1',
                engine: 'excalidraw',
                snapshot: { elements: [{ type: 'rectangle' }] },
            });

            expect(result.revision).toBe(2);
        });
    });
});
```

### 集成测试

见 `API_TESTING_GUIDE.md`

### E2E 测试

```typescript
// tests/e2e/canvas.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Canvas功能', () => {
    test.beforeEach(async ({ page }) => {
        // 登录
        await page.goto('/login');
        await page.fill('input[name="username"]', 'testuser');
        await page.fill('input[name="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForURL('/');
    });

    test('应该能够创建新的 Canvas 项目', async ({ page }) => {
        await page.goto('/canvas');
        await page.click('text=新建项目');
        await page.fill('input[name="name"]', '测试项目');
        await page.click('button:has-text("创建")');

        await expect(page.locator('text=测试项目')).toBeVisible();
    });

    test('应该能够保存绘图', async ({ page }) => {
        await page.goto('/canvas/test-project-id');
        
        // 绘制一个矩形
        // ... Excalidraw 操作
        
        // 等待自动保存
        await page.waitForTimeout(3000);
        
        // 刷新页面
        await page.reload();
        
        // 验证绘图已保存
        await expect(page.locator('.excalidraw-canvas')).toBeVisible();
    });
});
```

## 代码规范

### TypeScript 规范

```typescript
// ✅ 好的实践

// 使用明确的类型
interface User {
    id: string;
    username: string;
    email: string;
}

function getUser(id: string): Promise<User | null> {
    // ...
}

// 使用类型守卫
function isUser(obj: any): obj is User {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.username === 'string'
    );
}

// ❌ 避免的实践

// 避免使用 any
function process(data: any) {  // Bad
    // ...
}

// 避免类型断言
const user = data as User;  // Bad，除非确实必要
```

### React 组件规范

```typescript
// ✅ 好的实践

interface ButtonProps {
    onClick: () => void;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
}

export function Button({ onClick, children, variant = 'primary' }: ButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`btn btn-${variant}`}
        >
            {children}
        </button>
    );
}

// 使用组合而非继承
function UserProfile({ userId }: { userId: string }) {
    const user = useUser(userId);
    
    return (
        <Card>
            <UserAvatar user={user} />
            <UserInfo user={user} />
        </Card>
    );
}
```

### 命名规范

- **组件**：PascalCase（`UserProfile.tsx`）
- **函数**：camelCase（`getUserById`）
- **常量**：UPPER_SNAKE_CASE（`MAX_RETRY_COUNT`）
- **类型/接口**：PascalCase（`UserProfile`）
- **私有方法**：带前缀下划线（`_internalMethod`）

### 文件组织

```
component/
├── UserProfile.tsx          # 主组件
├── UserProfile.test.tsx     # 测试文件
├── UserProfile.module.css   # 样式（如果不用 Tailwind）
└── index.ts                 # 导出
```

## 性能优化

### 前端优化

1. **代码分割**

```typescript
// 动态导入
const CanvasEditor = dynamic(() => import('@/components/canvas/CanvasEditor'), {
    loading: () => <div>Loading...</div>,
    ssr: false,
});
```

2. **图片优化**

```typescript
import Image from 'next/image';

<Image
    src="/logo.png"
    alt="Logo"
    width={200}
    height={100}
    priority  // 首屏图片
/>
```

3. **React 性能优化**

```typescript
import { memo, useMemo, useCallback } from 'react';

// 使用 memo 避免不必要的重渲染
export const UserCard = memo(function UserCard({ user }: Props) {
    // ...
});

// 使用 useMemo 缓存计算结果
const sortedUsers = useMemo(() => {
    return users.sort((a, b) => a.name.localeCompare(b.name));
}, [users]);

// 使用 useCallback 缓存回调函数
const handleClick = useCallback(() => {
    console.log('Clicked');
}, []);
```

### 后端优化

1. **数据库查询优化**

```typescript
// ✅ 使用索引
await db.query(
    'SELECT * FROM users WHERE email = $1',  // email 有索引
    [email]
);

// ✅ 只查询需要的字段
await db.query(
    'SELECT id, username FROM users WHERE id = $1',
    [userId]
);

// ❌ 避免 N+1 查询
// Bad
for (const user of users) {
    const posts = await getPostsByUser(user.id);
}

// Good：使用 JOIN 或批量查询
const posts = await db.query(
    'SELECT * FROM posts WHERE user_id = ANY($1)',
    [users.map(u => u.id)]
);
```

2. **连接池配置**

```typescript
const pool = new Pool({
    max: 20,                    // 最大连接数
    idleTimeoutMillis: 30000,  // 空闲超时
    connectionTimeoutMillis: 2000,
});
```

## 安全实践

### 输入验证

```typescript
import { z } from 'zod';

const CreateProjectSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
    const body = await request.json();
    
    // 验证输入
    const result = CreateProjectSchema.safeParse(body);
    if (!result.success) {
        return NextResponse.json(
            { code: 400, msg: '参数无效' },
            { status: 400 }
        );
    }
    
    const { name, description } = result.data;
    // ...
}
```

### SQL 注入防护

```typescript
// ✅ 使用参数化查询
await db.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
);

// ❌ 永远不要拼接 SQL
await db.query(
    `SELECT * FROM users WHERE username = '${username}'`  // 危险！
);
```

### XSS 防护

```typescript
// React 自动转义，但注意 dangerouslySetInnerHTML
// ❌ 不安全
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ 使用库清理 HTML
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

### CSRF 防护

Next.js App Router 默认提供 CSRF 保护，但需要正确配置：

```typescript
// next.config.mjs
export default {
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                ],
            },
        ];
    },
};
```

## 贡献指南

### 提交 Issue

提交 Bug 报告或功能建议时，请包含：

1. **问题描述**：清晰描述问题
2. **复现步骤**：如何复现问题
3. **预期行为**：应该发生什么
4. **实际行为**：实际发生了什么
5. **环境信息**：操作系统、浏览器、Node.js 版本
6. **截图**：如果适用

### 提交 Pull Request

1. Fork 仓库
2. 创建功能分支
3. 编写代码和测试
4. 确保所有测试通过
5. 提交 PR 并描述变更
6. 等待 Code Review

### Code Review 标准

- 代码符合项目规范
- 有适当的测试覆盖
- 文档已更新
- 无明显性能问题
- 无安全隐患

## 相关资源

- [项目 README](../README.md)
- [API 测试指南](./API_TESTING_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)
- [用户使用指南](./USER_GUIDE.md)
- [Next.js 文档](https://nextjs.org/docs)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)

---

**持续更新中...**

如有问题或建议，请提交 Issue 或联系维护者。
