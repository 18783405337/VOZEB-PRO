# Canvas Drawing 数据库 Schema 设计

**版本**: 1.0  
**创建日期**: 2026-08-14  
**状态**: 待实施

---

## 📋 表结构设计

### 1. canvas_drawing_documents

存储绘图文档的主表

```sql
CREATE TABLE IF NOT EXISTS canvas_drawing_documents (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    project_id UUID NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 绘图标识
    drawing_id TEXT NOT NULL,
    
    -- 引擎类型
    engine TEXT NOT NULL CHECK (engine IN ('excalidraw', 'tldraw')),
    
    -- 绘图数据
    snapshot JSONB NOT NULL,
    
    -- 版本信息
    revision INTEGER NOT NULL DEFAULT 1,
    
    -- 统计信息
    shape_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 1,
    
    -- 预览图
    preview_url TEXT,
    preview_storage_key TEXT,
    
    -- 渲染数据
    render_url TEXT,
    render_storage_key TEXT,
    render_metadata JSONB,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- 唯一约束
    UNIQUE(project_id, drawing_id)
);

-- 索引
CREATE INDEX idx_canvas_drawing_documents_project_id 
    ON canvas_drawing_documents(project_id);

CREATE INDEX idx_canvas_drawing_documents_user_id 
    ON canvas_drawing_documents(user_id);

CREATE INDEX idx_canvas_drawing_documents_updated_at 
    ON canvas_drawing_documents(updated_at DESC);

-- 更新时间触发器
CREATE TRIGGER update_canvas_drawing_documents_updated_at
    BEFORE UPDATE ON canvas_drawing_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2. canvas_drawing_versions

存储绘图文档的历史版本

```sql
CREATE TABLE IF NOT EXISTS canvas_drawing_versions (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    document_id UUID NOT NULL REFERENCES canvas_drawing_documents(id) ON DELETE CASCADE,
    
    -- 版本号
    revision INTEGER NOT NULL,
    
    -- 版本数据
    snapshot JSONB NOT NULL,
    
    -- 变更描述
    description TEXT,
    
    -- 统计信息
    shape_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 1,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- 唯一约束
    UNIQUE(document_id, revision)
);

-- 索引
CREATE INDEX idx_canvas_drawing_versions_document_id 
    ON canvas_drawing_versions(document_id);

CREATE INDEX idx_canvas_drawing_versions_created_at 
    ON canvas_drawing_versions(created_at DESC);
```

---

## 🔄 Migration 脚本

### Up Migration

```sql
-- Migration: 001_create_canvas_drawing_tables.up.sql

BEGIN;

-- 创建 canvas_drawing_documents 表
CREATE TABLE IF NOT EXISTS canvas_drawing_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drawing_id TEXT NOT NULL,
    engine TEXT NOT NULL CHECK (engine IN ('excalidraw', 'tldraw')),
    snapshot JSONB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    shape_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 1,
    preview_url TEXT,
    preview_storage_key TEXT,
    render_url TEXT,
    render_storage_key TEXT,
    render_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, drawing_id)
);

CREATE INDEX idx_canvas_drawing_documents_project_id 
    ON canvas_drawing_documents(project_id);
CREATE INDEX idx_canvas_drawing_documents_user_id 
    ON canvas_drawing_documents(user_id);
CREATE INDEX idx_canvas_drawing_documents_updated_at 
    ON canvas_drawing_documents(updated_at DESC);

-- 创建 canvas_drawing_versions 表
CREATE TABLE IF NOT EXISTS canvas_drawing_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES canvas_drawing_documents(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    description TEXT,
    shape_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, revision)
);

CREATE INDEX idx_canvas_drawing_versions_document_id 
    ON canvas_drawing_versions(document_id);
CREATE INDEX idx_canvas_drawing_versions_created_at 
    ON canvas_drawing_versions(created_at DESC);

-- 创建更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_canvas_drawing_documents_updated_at
    BEFORE UPDATE ON canvas_drawing_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### Down Migration

```sql
-- Migration: 001_create_canvas_drawing_tables.down.sql

BEGIN;

DROP TRIGGER IF EXISTS update_canvas_drawing_documents_updated_at 
    ON canvas_drawing_documents;

DROP TABLE IF EXISTS canvas_drawing_versions CASCADE;
DROP TABLE IF EXISTS canvas_drawing_documents CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column();

COMMIT;
```

---

## 📊 数据模型关系

```
users
  |
  ├─> canvas_projects
  |     |
  |     └─> canvas_drawing_documents
  |           |
  |           └─> canvas_drawing_versions
  |
  └─> canvas_drawing_documents (直接关联)
```

---

## 💾 存储估算

### 单个绘图文档
- Snapshot (JSONB): 10KB - 1MB (平均 50KB)
- Metadata: ~1KB
- **平均大小**: ~51KB

### 版本历史 (10个版本)
- 51KB × 10 = 510KB

### 1000个绘图文档
- 文档: 51KB × 1000 = 51MB
- 版本: 510KB × 1000 = 510MB
- **总计**: ~561MB

### 预览图存储
- 预览图 (300x225 PNG): ~20KB
- 1000个文档: 20MB

---

## 🔐 权限设计

### Row Level Security (RLS)

```sql
-- 启用 RLS
ALTER TABLE canvas_drawing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_drawing_versions ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的绘图
CREATE POLICY canvas_drawing_documents_user_policy
    ON canvas_drawing_documents
    FOR ALL
    USING (user_id = current_user_id());

CREATE POLICY canvas_drawing_versions_user_policy
    ON canvas_drawing_versions
    FOR ALL
    USING (
        document_id IN (
            SELECT id FROM canvas_drawing_documents 
            WHERE user_id = current_user_id()
        )
    );
```

---

## 🎯 查询示例

### 1. 获取项目的所有绘图
```sql
SELECT 
    id,
    drawing_id,
    engine,
    revision,
    shape_count,
    page_count,
    preview_url,
    updated_at
FROM canvas_drawing_documents
WHERE project_id = $1
ORDER BY updated_at DESC;
```

### 2. 获取绘图详情
```sql
SELECT 
    d.*,
    COUNT(v.id) as version_count
FROM canvas_drawing_documents d
LEFT JOIN canvas_drawing_versions v ON v.document_id = d.id
WHERE d.project_id = $1 AND d.drawing_id = $2
GROUP BY d.id;
```

### 3. 获取版本历史
```sql
SELECT 
    revision,
    shape_count,
    page_count,
    description,
    created_at
FROM canvas_drawing_versions
WHERE document_id = $1
ORDER BY revision DESC
LIMIT 10;
```

### 4. 清理旧版本（保留最近10个）
```sql
DELETE FROM canvas_drawing_versions
WHERE document_id = $1
AND revision NOT IN (
    SELECT revision 
    FROM canvas_drawing_versions
    WHERE document_id = $1
    ORDER BY revision DESC
    LIMIT 10
);
```

---

## 🔄 数据同步策略

### LocalForage ↔ PostgreSQL

#### 上传策略
1. 用户保存绘图 → LocalForage
2. 后台异步 → PostgreSQL
3. 成功后更新 sync_status

#### 下载策略
1. 首次加载 → PostgreSQL
2. 缓存到 LocalForage
3. 后续访问优先 LocalForage

#### 冲突解决
- Last Write Wins (基于 updated_at)
- revision 递增确保版本顺序

---

## 📈 性能优化

### 索引策略
- `project_id`: 频繁按项目查询
- `user_id`: RLS 权限检查
- `updated_at`: 排序和分页

### JSONB 优化
```sql
-- 为 snapshot 创建 GIN 索引（如果需要查询内部字段）
CREATE INDEX idx_canvas_drawing_documents_snapshot_gin
    ON canvas_drawing_documents USING GIN (snapshot);
```

### 分区策略（可选）
```sql
-- 按创建月份分区
CREATE TABLE canvas_drawing_documents_y2026m08 
    PARTITION OF canvas_drawing_documents
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
```

---

## 🧪 测试数据

### 插入测试数据
```sql
-- 插入测试绘图
INSERT INTO canvas_drawing_documents (
    project_id,
    user_id,
    drawing_id,
    engine,
    snapshot,
    revision,
    shape_count,
    page_count
) VALUES (
    'project-uuid',
    'user-uuid',
    'drawing-test-001',
    'tldraw',
    '{"store": {}, "schema": {"schemaVersion": 1, "storeVersion": 4}}'::jsonb,
    1,
    0,
    1
);
```

---

## 📝 备注

### 未来扩展
- [ ] 添加 `tags` 字段支持标签
- [ ] 添加 `is_template` 支持模板功能
- [ ] 添加 `shared_with` 支持协作
- [ ] 添加 `export_settings` 支持导出配置

### 兼容性
- PostgreSQL 12+
- 支持 JSONB 类型
- 支持 UUID 扩展
- 支持触发器

---

**文档版本**: 1.0  
**最后更新**: 2026-08-14  
**下次审查**: 实施后
