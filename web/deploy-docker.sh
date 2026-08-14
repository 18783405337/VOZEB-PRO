#!/bin/bash

# Canvas Integration - Docker 快速部署脚本
# 自动化部署流程

set -e

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║              🐳 Canvas Integration - Docker 部署工具                          ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# 检查 Docker
echo "🔍 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo ""

# 检查端口
echo "🔍 检查端口占用..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  端口 3000 已被占用"
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  端口 5432 已被占用"
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ 端口检查通过"
echo ""

# 询问部署模式
echo "📦 选择部署模式:"
echo "  1) 完整部署 (构建 + 启动 + 迁移)"
echo "  2) 仅启动服务"
echo "  3) 仅运行迁移"
echo "  4) 停止所有服务"
read -p "请选择 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🚀 开始完整部署..."
        echo ""

        # 停止旧容器
        echo "🛑 停止旧容器..."
        docker-compose down

        # 构建镜像
        echo "🔨 构建 Docker 镜像..."
        docker-compose build

        # 启动数据库
        echo "📦 启动 PostgreSQL 数据库..."
        docker-compose up -d postgres

        # 等待数据库就绪
        echo "⏳ 等待数据库启动..."
        sleep 10

        # 运行迁移
        echo "📊 运行数据库迁移..."
        docker-compose --profile migration run --rm migration || {
            echo "⚠️  迁移失败，尝试手动迁移..."
            # 手动运行迁移脚本
            docker-compose exec postgres psql -U canvas_user -d canvas_db -f /docker-entrypoint-initdb.d/init-db.sh
        }

        # 启动 Web 服务
        echo "🌐 启动 Web 应用..."
        docker-compose up -d web

        echo ""
        echo "✅ 部署完成！"
        ;;

    2)
        echo ""
        echo "🚀 启动服务..."
        docker-compose up -d
        echo "✅ 服务已启动！"
        ;;

    3)
        echo ""
        echo "📊 运行数据库迁移..."
        docker-compose --profile migration run --rm migration
        echo "✅ 迁移完成！"
        ;;

    4)
        echo ""
        echo "🛑 停止所有服务..."
        docker-compose down
        echo "✅ 服务已停止！"
        exit 0
        ;;

    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# 显示服务状态
echo "📊 服务状态:"
docker-compose ps

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# 显示访问信息
echo "🌐 访问信息:"
echo "  Web 应用:  http://localhost:3000"
echo "  数据库:    localhost:5432"
echo ""

# 显示常用命令
echo "📝 常用命令:"
echo "  查看日志:  docker-compose logs -f"
echo "  停止服务:  docker-compose down"
echo "  重启服务:  docker-compose restart"
echo "  进入容器:  docker-compose exec web sh"
echo ""

# 检查服务健康
echo "🔍 健康检查:"
echo -n "  数据库: "
if docker-compose exec postgres pg_isready -U canvas_user >/dev/null 2>&1; then
    echo "✅ 运行中"
else
    echo "❌ 未就绪"
fi

echo -n "  Web 应用: "
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ 运行中"
else
    echo "⏳ 启动中... (请等待 30 秒后再次检查)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "✨ 部署完成！访问 http://localhost:3000 开始使用"
echo ""
