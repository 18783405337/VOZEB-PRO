# Web 应用

该目录包含 VOZEB PRO 主应用，包括用户创作工作台、Canvas、短剧项目、管理后台、Route Handler、身份认证、服务端存储和生成任务 Worker。

## 本地开发

```bash
pnpm install
pnpm dev
```

## 生产构建

```bash
pnpm build
pnpm start:standalone
```

## SaaS default tenant backfill

The startup schema only adds nullable `tenant_id` columns. Run the backfill explicitly after checking the dry-run report:

```bash
pnpm migrate:saas:backfill
pnpm migrate:saas:backfill -- --write --confirm-database <database-name>
```

The default mode is read-only. Write mode requires the exact database name and validates orphan references and cross-tenant conflicts before updating only NULL `tenant_id` values. It verifies that no NULLs or conflicts remain before applying `NOT NULL` constraints.

## SaaS rollout

Keep `VOZEB_PRO_SAAS_ENABLED=0` until the application is using PostgreSQL and the default-tenant backfill has completed. In this mode, existing generation routes continue to use the `default` tenant and tenant administration APIs return `501`.

After the migration gate passes, set:

```bash
VOZEB_PRO_SAAS_ENABLED=1
VOZEB_PRO_DEFAULT_TENANT_ID=default
VOZEB_PRO_PLATFORM_HOSTS=app.example.com
```

When SaaS is enabled, tenant-aware routes require PostgreSQL and an active tenant membership. Validate task and generated-asset isolation with two tenant origins and authenticated Playwright storage states:

```bash
E2E_TENANT_A_URL=https://tenant-a.example.com
E2E_TENANT_A_STORAGE_STATE=./tenant-a-state.json
E2E_TENANT_B_URL=https://tenant-b.example.com
E2E_TENANT_B_STORAGE_STATE=./tenant-b-state.json
pnpm e2e -- tenant-isolation.spec.ts
```

构建脚本先在独立进程中执行严格 TypeScript 检查，再运行 Next.js 构建。默认使用 Node.js 与 Next.js 的可用资源策略；只有部署环境确有资源限制时才显式设置 `NEXT_BUILD_CPUS` 或 `NODE_OPTIONS`。

## 服务端数据

PostgreSQL 或 JSON Provider 保存用户会话、Canvas、短剧、素材、工作台记录、生成任务和 Agent 事件。图片、视频与音频写入 `VOZEB_PRO_DATA_DIR`；Docker 部署必须持久化该目录，并与数据库一起备份。
