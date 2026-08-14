#!/bin/bash
set -e

echo "🚀 Initializing Canvas Integration Database..."

# 等待 PostgreSQL 完全启动
until pg_isready -U canvas_user -d canvas_db; do
  echo "⏳ Waiting for PostgreSQL..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# 运行迁移脚本
echo "📦 Running migrations..."

# 注意：这里需要根据实际的 migration 文件路径调整
# 由于我们使用的是 Node.js，这里只是创建基础结构

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- 创建基础扩展
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 创建 update_updated_at_column 函数
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    \$\$ LANGUAGE plpgsql;

    GRANT ALL PRIVILEGES ON DATABASE canvas_db TO canvas_user;
EOSQL

echo "✅ Database initialized successfully!"
