# VOZEB PRO 部署指南

本文档提供 VOZEB PRO 在不同环境下的详细部署步骤、配置说明和运维最佳实践。

## 目录

- [部署前准备](#部署前准备)
- [Docker Compose 部署](#docker-compose-部署)
- [源码部署](#源码部署)
- [生产环境部署](#生产环境部署)
- [数据库迁移](#数据库迁移)
- [反向代理配置](#反向代理配置)
- [SSL 证书配置](#ssl-证书配置)
- [监控和日志](#监控和日志)
- [备份策略](#备份策略)
- [性能优化](#性能优化)
- [故障排查](#故障排查)

## 部署前准备

### 服务器要求

**最低配置（测试环境）：**
- CPU: 1 核
- 内存: 1GB + 1GB swap
- 磁盘: 10GB SSD
- 操作系统: 64位 Linux（Ubuntu 20.04+ / CentOS 8+）

**推荐配置（生产环境）：**
- CPU: 2-4 核
- 内存: 4GB+
- 磁盘: 40GB+ SSD
- 操作系统: 64位 Linux

**高性能配置（短剧和视频处理）：**
- CPU: 4 核+
- 内存: 8GB+
- 磁盘: 80GB+ SSD

### 依赖软件

必需：
- Docker 20.10+
- Docker Compose v2+
- PostgreSQL 16（如使用外部数据库）
- HTTPS 域名和证书

可选：
- Nginx（作为反向代理）
- FFmpeg（用于视频处理）
- Redis（用于缓存，待实现）

### 域名和 DNS

1. 购买域名
2. 配置 DNS A 记录指向服务器 IP
3. 等待 DNS 生效（通常 5-30 分钟）
4. 验证域名解析：`nslookup your-domain.com`

### SSL 证书

推荐使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
sudo apt-get update
sudo apt-get install certbot

# 获取证书（使用 standalone 模式）
sudo certbot certonly --standalone -d your-domain.com

# 证书位置
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# 设置自动续期
sudo crontab -e
# 添加：0 0 1 * * certbot renew --quiet
```

## Docker Compose 部署

### 标准部署（应用 + 数据库）

1. **克隆仓库**

```bash
git clone https://github.com/18783405337/VOZEB-PRO.git
cd VOZEB-PRO
```

2. **配置环境变量**

```bash
cp .env.example .env
nano .env
```

必需配置：

```env
# 站点 URL（必须是 HTTPS）
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# 数据库密码
POSTGRES_PASSWORD=your_strong_password_here

# 加密密钥（生成方法见下）
VOZEB_PRO_ENCRYPTION_KEY=your_32_char_encryption_key

# 安装令牌（只用一次）
VOZEB_PRO_INSTALL_TOKEN=your_install_token

# 维护令牌
VOZEB_PRO_MAINTENANCE_TOKEN=your_maintenance_token

# 数据目录
VOZEB_PRO_DATA_DIR=/var/lib/vozeb-pro/data
```

生成密钥：

```bash
# 生成加密密钥
openssl rand -hex 32

# 生成安装令牌
openssl rand -hex 32

# 生成维护令牌
openssl rand -hex 32
```

3. **启动服务**

```bash
# 拉取最新镜像
docker compose pull

# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 查看服务状态
docker compose ps
```

4. **初始化数据库**

访问 `https://your-domain.com/install`：

1. 输入安装令牌（从 `.env` 复制）
2. 点击「检查数据库连接」
3. 点击「初始化数据库表结构」
4. 创建首个管理员账户
5. 登录管理后台

5. **安装后配置**

安装完成后，可以从 `.env` 中移除 `VOZEB_PRO_INSTALL_TOKEN`。

### 使用外部数据库

如果已有 PostgreSQL 数据库：

```bash
# 使用外部数据库配置
docker compose -f docker-compose.external-db.yml up -d
```

修改 `.env`：

```env
VOZEB_PRO_DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://username:password@host:5432/database_name
VOZEB_PRO_DATABASE_SSL=1  # 如果需要 SSL
```

### 宝塔面板部署

如果使用宝塔面板管理 PostgreSQL：

1. **在宝塔中创建数据库**

- 数据库名：vozeb_pro
- 用户名：vozeb_user
- 密码：强密码

2. **使用宝塔配置文件**

```bash
docker compose -f docker-compose.baota.yml up -d
```

3. **配置环境变量**

```env
DATABASE_URL=postgres://vozeb_user:password@127.0.0.1:5432/vozeb_pro
VOZEB_PRO_DATABASE_SSL=0
VOZEB_PRO_TRUSTED_PROXY_HOPS=1
```

4. **配置宝塔反向代理**

在宝塔面板中：
- 站点 → 反向代理
- 目标地址：http://127.0.0.1:3000
- 发送域名：$host
- 添加自定义 Header：
  - X-Forwarded-Host: $host
  - X-Forwarded-Proto: $scheme
  - X-Forwarded-For: $proxy_add_x_forwarded_for

### 低内存服务器部署

对于 1GB 内存的服务器：

```bash
docker compose -f docker-compose.lowmem.yml up -d
```

配置文件会：
- 使用外部数据库
- 减少 Node.js 内存限制
- 禁用不必要的功能

建议配置 swap：

```bash
# 创建 1GB swap
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久启用
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 源码部署

### 开发环境

1. **安装依赖**

```bash
# 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 pnpm
npm install -g pnpm@latest

# 验证版本
node --version  # v22.x.x
pnpm --version  # 10.x.x
```

2. **安装 PostgreSQL 16**

```bash
# Ubuntu/Debian
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install postgresql-16

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建数据库
sudo -u postgres psql
CREATE DATABASE vozeb_pro;
CREATE USER vozeb_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE vozeb_pro TO vozeb_user;
\q
```

3. **配置项目**

```bash
cd web
cp .env.example .env.local
nano .env.local
```

配置数据库连接：

```env
DATABASE_URL=postgres://vozeb_user:your_password@localhost:5432/vozeb_pro
VOZEB_PRO_ENCRYPTION_KEY=your_32_char_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. **安装依赖并运行**

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

访问 `http://localhost:3000`

### 生产构建

```bash
cd web

# 生产构建
pnpm run build

# 启动生产服务
pnpm start
```

### 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
cd web
pm2 start npm --name "vozeb-pro" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs vozeb-pro

# 开机自启
pm2 startup
pm2 save
```

## 生产环境部署

### 完整生产配置

1. **系统优化**

```bash
# 增加文件描述符限制
sudo nano /etc/security/limits.conf
# 添加：
* soft nofile 65536
* hard nofile 65536

# 优化内核参数
sudo nano /etc/sysctl.conf
# 添加：
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 2048
vm.swappiness = 10

# 应用配置
sudo sysctl -p
```

2. **配置防火墙**

```bash
# UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# 或 iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
```

3. **配置 Nginx 反向代理**

```nginx
# /etc/nginx/sites-available/vozeb-pro
upstream vozeb_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # 客户端最大上传大小
    client_max_body_size 500M;
    client_body_buffer_size 10M;
    
    # 超时设置
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
    
    location / {
        proxy_pass http://vozeb_backend;
        proxy_http_version 1.1;
        
        # 必需的代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 禁用缓冲
        proxy_buffering off;
        proxy_request_buffering off;
    }
    
    # 静态文件缓存
    location /_next/static/ {
        proxy_pass http://vozeb_backend;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 健康检查
    location /api/health/live {
        proxy_pass http://vozeb_backend;
        access_log off;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/vozeb-pro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. **配置 Worker 服务**

创建 systemd 服务：

```ini
# /etc/systemd/system/vozeb-worker.service
[Unit]
Description=VOZEB PRO Generation Worker
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/vozeb-pro/web
Environment="NODE_ENV=production"
EnvironmentFile=/opt/vozeb-pro/.env
ExecStart=/usr/bin/node scripts/generation-worker.mjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动 Worker：

```bash
sudo systemctl daemon-reload
sudo systemctl enable vozeb-worker
sudo systemctl start vozeb-worker
sudo systemctl status vozeb-worker
```

## 数据库迁移

### 运行迁移脚本

```bash
# 查看迁移状态
node scripts/run-migrations.mjs status

# 运行所有待执行的迁移
node scripts/run-migrations.mjs up

# 回滚所有迁移（谨慎使用）
node scripts/run-migrations.mjs down
```

### 迁移顺序

VOZEB PRO 迁移按以下顺序执行：

1. `001_create_canvas_drawing_tables` - Canvas Drawing 表
2. `002_create_canvas_script_tables` - Canvas Script 表
3. `003_create_canvas_skill_tables` - Canvas Skill 表

### 手动执行迁移

如果自动迁移失败，可以手动执行：

```bash
# 连接数据库
psql $DATABASE_URL

# 执行 SQL 文件
\i web/src/lib/server/database/migrations/001_create_canvas_drawing_tables.up.sql
\i web/src/lib/server/database/migrations/002_create_canvas_script_tables.up.sql
\i web/src/lib/server/database/migrations/003_create_canvas_skill_tables.up.sql

# 退出
\q
```

### 迁移回滚

回滚特定迁移：

```bash
psql $DATABASE_URL -f web/src/lib/server/database/migrations/003_create_canvas_skill_tables.down.sql
```

## 反向代理配置

### Nginx 配置示例

见上文「生产环境部署」章节。

### Caddy 配置

```caddyfile
# Caddyfile
your-domain.com {
    reverse_proxy localhost:3000 {
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
    
    encode gzip
    
    # 文件上传限制
    request_body {
        max_size 500MB
    }
}
```

运行 Caddy：

```bash
caddy run --config Caddyfile
```

### Apache 配置

```apache
<VirtualHost *:443>
    ServerName your-domain.com
    
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/your-domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/your-domain.com/privkey.pem
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"
    
    # 文件上传限制
    LimitRequestBody 524288000
</VirtualHost>
```

## SSL 证书配置

### Let's Encrypt 自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# 设置自动续期
sudo crontab -e
# 添加：
0 0 1 * * certbot renew --quiet && systemctl reload nginx
```

### 使用 Cloudflare SSL

如果使用 Cloudflare 作为 CDN：

1. 在 Cloudflare 启用 Full (Strict) SSL
2. 下载 Origin Certificate
3. 配置 Nginx 使用该证书

### 自签名证书（仅测试）

```bash
# 生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/vozeb-selfsigned.key \
  -out /etc/ssl/certs/vozeb-selfsigned.crt
```

## 监控和日志

### 应用日志

```bash
# Docker Compose 日志
docker compose logs -f app

# 查看最近 100 行
docker compose logs --tail=100 app

# 导出日志
docker compose logs app > logs.txt
```

### Nginx 日志

```bash
# 访问日志
tail -f /var/log/nginx/access.log

# 错误日志
tail -f /var/log/nginx/error.log

# 分析日志
sudo goaccess /var/log/nginx/access.log -o report.html --log-format=COMBINED
```

### PostgreSQL 日志

```bash
# 查看日志位置
psql -c "SHOW log_directory;"
psql -c "SHOW log_filename;"

# 查看日志
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### 系统监控

安装监控工具：

```bash
# 安装 htop
sudo apt-get install htop

# 安装 iotop
sudo apt-get install iotop

# 查看系统资源
htop

# 查看磁盘 IO
sudo iotop
```

### 设置监控告警

使用 Prometheus + Grafana：

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
  
  grafana:
    image: grafana/grafana
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

volumes:
  prometheus_data:
  grafana_data:
```

## 备份策略

### 数据库备份

**自动备份脚本：**

```bash
#!/bin/bash
# /opt/scripts/backup-vozeb-db.sh

BACKUP_DIR="/var/backups/vozeb-pro"
DATE=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="postgres://user:pass@localhost:5432/vozeb_pro"

mkdir -p $BACKUP_DIR

# 备份数据库
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 保留最近 7 天
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

设置定时任务：

```bash
sudo chmod +x /opt/scripts/backup-vozeb-db.sh

sudo crontab -e
# 每天凌晨 2 点备份
0 2 * * * /opt/scripts/backup-vozeb-db.sh
```

### 媒体文件备份

```bash
#!/bin/bash
# /opt/scripts/backup-vozeb-media.sh

BACKUP_DIR="/var/backups/vozeb-pro"
DATA_DIR="/var/lib/vozeb-pro/data"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 打包媒体文件
tar czf $BACKUP_DIR/media_$DATE.tar.gz -C $DATA_DIR .

# 保留最近 7 天
find $BACKUP_DIR -name "media_*.tar.gz" -mtime +7 -delete

echo "Media backup completed: media_$DATE.tar.gz"
```

### 完整备份

```bash
#!/bin/bash
# /opt/scripts/full-backup.sh

BACKUP_DIR="/var/backups/vozeb-pro"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份数据库
/opt/scripts/backup-vozeb-db.sh

# 备份媒体
/opt/scripts/backup-vozeb-media.sh

# 备份配置
cp /opt/vozeb-pro/.env $BACKUP_DIR/env_$DATE.backup

echo "Full backup completed"
```

### 备份到远程

使用 rsync 同步到远程服务器：

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/vozeb-pro"
REMOTE_HOST="backup-server.example.com"
REMOTE_DIR="/backups/vozeb-pro"

rsync -avz --delete $BACKUP_DIR/ $REMOTE_HOST:$REMOTE_DIR/
```

### 恢复数据

**恢复数据库：**

```bash
# 解压备份
gunzip db_20260814_020000.sql.gz

# 恢复数据库
psql $DATABASE_URL < db_20260814_020000.sql
```

**恢复媒体文件：**

```bash
# 解压媒体文件
tar xzf media_20260814_020000.tar.gz -C /var/lib/vozeb-pro/data/
```

## 性能优化

### PostgreSQL 优化

```sql
-- /etc/postgresql/16/main/postgresql.conf

# 连接设置
max_connections = 100
shared_buffers = 256MB        # 25% of RAM
effective_cache_size = 1GB    # 50-75% of RAM
work_mem = 4MB
maintenance_work_mem = 64MB

# WAL 设置
wal_buffers = 16MB
checkpoint_completion_target = 0.9
wal_compression = on

# 查询优化
random_page_cost = 1.1        # SSD
effective_io_concurrency = 200

# 日志
log_min_duration_statement = 1000  # 记录慢查询
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

重启 PostgreSQL：

```bash
sudo systemctl restart postgresql
```

### Node.js 优化

```env
# .env
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096"
```

### 图片优化

启用 Next.js 图片优化：

```javascript
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}
```

### 缓存配置

配置 Redis（待实现）：

```env
REDIS_URL=redis://localhost:6379
VOZEB_PRO_CACHE_TTL=3600
```

### CDN 加速

使用 Cloudflare 或阿里云 CDN：

1. 添加域名到 CDN
2. 配置缓存规则
3. 启用 Brotli 压缩
4. 配置 WebP 转换

## 故障排查

### 应用无法启动

**检查日志：**

```bash
docker compose logs app
```

**常见问题：**

1. 端口被占用：
```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

2. 数据库连接失败：
```bash
# 检查数据库
docker compose logs postgres
psql $DATABASE_URL -c "SELECT 1"
```

3. 环境变量错误：
```bash
docker compose config
```

### 数据库连接错误

```bash
# 检查数据库状态
sudo systemctl status postgresql

# 测试连接
psql -h localhost -U vozeb_user -d vozeb_pro

# 查看连接数
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# 查看活动连接
psql $DATABASE_URL -c "SELECT pid, usename, application_name, client_addr, state FROM pg_stat_activity;"
```

### 磁盘空间不足

```bash
# 查看磁盘使用
df -h

# 查找大文件
du -sh /var/lib/vozeb-pro/data/*

# 清理 Docker
docker system prune -a

# 清理日志
sudo journalctl --vacuum-time=7d
```

### 内存不足

```bash
# 查看内存使用
free -h

# 查看进程内存
ps aux --sort=-%mem | head

# 添加 swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 生成任务失败

1. 检查模型配置
2. 查看生成日志
3. 验证 API Key
4. 检查网络连接
5. 查看上游服务状态

```bash
# 测试 API 连接
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}'
```

### Nginx 502 错误

```bash
# 检查应用是否运行
docker compose ps

# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 检查上游连接
curl http://localhost:3000/api/health/live
```

### 性能问题

```bash
# 查看慢查询
psql $DATABASE_URL -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# 查看数据库大小
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('vozeb_pro'));"

# 查看表大小
psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

## 安全最佳实践

1. **定期更新系统和依赖**
2. **使用强密码和密钥**
3. **限制数据库访问**
4. **启用防火墙**
5. **定期备份数据**
6. **监控异常活动**
7. **使用 HTTPS**
8. **定期审计日志**

## 升级指南

### 升级步骤

1. **备份数据**
```bash
/opt/scripts/full-backup.sh
```

2. **拉取新版本**
```bash
cd /opt/vozeb-pro
git pull origin main
```

3. **更新镜像**
```bash
docker compose pull
```

4. **运行迁移**
```bash
node scripts/run-migrations.mjs up
```

5. **重启服务**
```bash
docker compose up -d
```

6. **验证功能**
```bash
curl https://your-domain.com/api/health/ready
```

## 相关文档

- [快速开始指南](./QUICKSTART.md)
- [开发者文档](./DEVELOPER_GUIDE.md)
- [API 文档](./API_DOCUMENTATION.md)
- [故障排查](./TROUBLESHOOTING.md)
