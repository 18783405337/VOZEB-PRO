# VOZEB PRO 快速开始指南

欢迎使用 VOZEB PRO！本指南将帮助您在 10 分钟内完成安装和基本配置。

## 前置要求

在开始之前，请确保您的服务器满足以下要求：

- **操作系统**：64 位 Linux（Ubuntu 20.04+ 或 CentOS 8+）
- **内存**：最低 1GB（推荐 4GB）
- **磁盘**：最低 10GB SSD（推荐 40GB+）
- **软件**：Docker 20.10+ 和 Docker Compose v2+
- **网络**：可访问的域名和 HTTPS 证书

## 快速安装（5 分钟）

### 1. 克隆仓库

```bash
git clone https://github.com/18783405337/VOZEB-PRO.git
cd VOZEB-PRO
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env
```

**最少需要修改以下配置：**

```env
# 站点 URL（必须是 HTTPS）
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# 数据库密码（设置强密码）
POSTGRES_PASSWORD=YourStrongPasswordHere

# 生成加密密钥
VOZEB_PRO_ENCRYPTION_KEY=<运行下方命令获取>

# 生成安装令牌（只用一次）
VOZEB_PRO_INSTALL_TOKEN=<运行下方命令获取>

# 生成维护令牌
VOZEB_PRO_MAINTENANCE_TOKEN=<运行下方命令获取>
```

**生成密钥命令：**

```bash
# 生成三个不同的 32 字符密钥
openssl rand -hex 32  # 用于 ENCRYPTION_KEY
openssl rand -hex 32  # 用于 INSTALL_TOKEN
openssl rand -hex 32  # 用于 MAINTENANCE_TOKEN
```

### 3. 启动服务

```bash
# 拉取镜像
docker compose pull

# 启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志（可选）
docker compose logs -f
```

等待 30 秒让服务完全启动。

### 4. 初始化数据库

在浏览器中访问：`https://your-domain.com/install`

按照向导完成以下步骤：

1. **输入安装令牌**：从 `.env` 文件复制 `VOZEB_PRO_INSTALL_TOKEN`
2. **检查数据库连接**：点击"检查数据库连接"按钮
3. **初始化数据库**：点击"初始化数据库表结构"按钮
4. **创建管理员**：设置管理员用户名和密码
5. **完成安装**：点击"完成安装"

🎉 恭喜！安装完成。

## 初始配置（5 分钟）

### 1. 登录管理后台

访问：`https://your-domain.com/admin`

使用刚才创建的管理员账号登录。

### 2. 配置 AI 模型（必需）

**路径：** 管理后台 → 模型渠道 → 添加渠道

**示例配置 - OpenAI：**

1. 选择协议：`OpenAI`
2. Base URL：`https://api.openai.com/v1`
3. API Key：输入您的 OpenAI API Key
4. 点击"测试连接"
5. 点击"同步模型"
6. 设置默认模型：
   - 文本：`gpt-4`
   - 图片：`dall-e-3`
   - 视频：（如果可用）

**其他支持的模型：**

- Anthropic Claude
- Google Gemini
- Stable Diffusion
- Midjourney（通过适配器）
- 本地部署的模型（A1111/Forge）

### 3. 配置积分系统（推荐）

**路径：** 管理后台 → 财务管理 → 积分规则

设置基础单价：

- 文本对话：1 积分/1000 tokens
- 图片生成：10 积分/张
- 视频生成：100 积分/个
- 音频生成：5 积分/次

设置免费额度：

- 新用户赠送：100 积分
- 每日签到：10 积分

### 4. 创建积分商品（可选）

**路径：** 管理后台 → 商品管理 → 添加商品

**示例商品：**

| 名称 | 积分 | 价格 | 优惠 |
|------|------|------|------|
| 入门包 | 100 | ¥9.9 | 无 |
| 标准包 | 500 | ¥49 | 2% |
| 专业包 | 1000 | ¥99 | 5% |
| 企业包 | 5000 | ¥499 | 10% |

### 5. 配置支付渠道（可选）

如果需要在线支付，配置支付渠道：

**路径：** 管理后台 → 支付管理 → 添加渠道

支持的支付方式：

- 支付宝
- 微信支付
- Stripe
- PayPal

填写对应的商户配置后，点击"测试连接"验证。

### 6. 配置 SMTP（推荐）

用于发送邮件验证码和通知：

**路径：** 管理后台 → 系统设置 → SMTP 配置

**常见 SMTP 配置：**

```
Gmail:
- Host: smtp.gmail.com
- Port: 587
- 使用 TLS: 是

QQ 邮箱:
- Host: smtp.qq.com
- Port: 587
- 使用 TLS: 是

阿里云邮件:
- Host: smtpdm.aliyun.com
- Port: 465
- 使用 SSL: 是
```

配置完成后，点击"发送测试邮件"验证。

## 开始使用

### 创建第一个用户

1. 访问首页：`https://your-domain.com`
2. 点击"注册"
3. 填写用户名、邮箱、密码
4. 完成注册并登录

### 第一次 AI 生成

#### 文生图示例：

1. 进入"图片工作台"
2. 输入提示词：`A cute cat playing with a ball of yarn, studio lighting, high quality`
3. 选择尺寸：`1024x1024`
4. 生成数量：`1`
5. 点击"开始生成"
6. 等待 30 秒
7. 预览和下载结果

#### 统一 Agent 示例：

1. 进入"统一 Agent"
2. 输入：`请帮我生成一张日落的图片`
3. Agent 会自动选择图片生成 Skill
4. 查看生成结果

#### Canvas 创作示例：

1. 进入"Canvas"
2. 点击"新建项目"
3. 添加 Drawing 节点绘制草图
4. 添加 Script 节点编写文案
5. 添加 Skill 节点生成图片
6. 保存项目

## 常见问题

### 安装问题

**Q: Docker Compose 启动失败？**

```bash
# 检查 Docker 版本
docker --version  # 需要 20.10+
docker compose version  # 需要 v2+

# 检查端口占用
sudo lsof -i :3000
sudo lsof -i :5432

# 查看详细日志
docker compose logs
```

**Q: 数据库连接失败？**

```bash
# 检查 PostgreSQL 容器状态
docker compose ps postgres

# 查看数据库日志
docker compose logs postgres

# 手动测试连接
docker compose exec postgres psql -U postgres
```

**Q: 端口 3000 已被占用？**

修改 `.env` 文件：

```env
VOZEB_PRO_PORT=3001
```

然后重启：

```bash
docker compose down
docker compose up -d
```

### 配置问题

**Q: 安装令牌无效？**

确保从 `.env` 文件**完整复制**令牌，不要有多余的空格或换行。

**Q: 模型连接失败？**

1. 检查 API Key 是否正确
2. 检查网络是否可以访问模型 API
3. 尝试使用代理（如需要）

**Q: 忘记管理员密码？**

运行密码重置脚本：

```bash
cd web
node --env-file-if-exists=../.env.local scripts/reset-admin-password.mjs
```

### 使用问题

**Q: 生成任务一直 pending？**

1. 检查 Worker 是否运行：
```bash
docker compose ps worker
```

2. 查看 Worker 日志：
```bash
docker compose logs worker
```

3. 重启 Worker：
```bash
docker compose restart worker
```

**Q: 积分扣除了但生成失败？**

系统会自动退还失败任务的积分。检查积分记录：

管理后台 → 用户管理 → 查看用户 → 积分记录

**Q: 上传的图片无法显示？**

1. 检查数据目录权限：
```bash
ls -la /var/lib/vozeb-pro/data
```

2. 如果使用 S3，检查 S3 配置和网络连接

## 下一步

现在您已经成功安装并配置了 VOZEB PRO，可以：

1. **阅读完整文档**
   - [用户使用指南](./USER_GUIDE.md) - 了解所有功能
   - [开发者文档](./DEVELOPER_GUIDE.md) - 二次开发
   - [API 文档](./API_DOCUMENTATION.md) - API 集成

2. **探索高级功能**
   - 配置更多 AI 模型
   - 设置自定义 Skill
   - 配置对象存储（S3/OSS）
   - 集成更多支付方式

3. **性能优化**
   - [部署指南](./DEPLOYMENT_GUIDE.md) - 生产环境优化
   - 配置 CDN 加速
   - 设置数据库备份
   - 配置监控告警

4. **加入社区**
   - QQ 群：1049777515
   - GitHub：https://github.com/18783405337/VOZEB-PRO
   - 提交 Issue 和 PR

## 安全提醒

1. **定期更新密码**：包括管理员密码和数据库密码
2. **备份数据**：定期备份数据库和媒体文件
3. **更新系统**：及时更新到最新版本
4. **监控日志**：定期查看系统日志，及时发现异常
5. **保护密钥**：不要将 `.env` 文件提交到 Git

## 获取帮助

如果遇到问题：

1. 查看[完整文档](../README.md)
2. 搜索已有的 [Issues](https://github.com/18783405337/VOZEB-PRO/issues)
3. 在 QQ 群提问：1049777515
4. 提交新的 Issue

## 卸载

如果需要完全卸载：

```bash
# 停止并删除容器
docker compose down

# 删除数据卷（会删除所有数据！）
docker compose down -v

# 删除项目目录
cd ..
rm -rf VOZEB-PRO
```

---

**祝您使用愉快！** 🚀

如有任何问题或建议，欢迎联系我们。
