# VOZEB PRO API 文档汇总

本文档提供 VOZEB PRO 所有 API 端点的完整参考。

## 目录

- [认证 API](#认证-api)
- [Canvas API](#canvas-api)
- [生成任务 API](#生成任务-api)
- [计费 API](#计费-api)
- [素材 API](#素材-api)
- [管理后台 API](#管理后台-api)
- [错误码](#错误码)

## 通用说明

### 基础 URL

```
生产环境: https://your-domain.com/api
开发环境: http://localhost:3000/api
```

### 认证方式

使用 Session Cookie 认证：

```http
Cookie: session=<session_token>
```

### 响应格式

所有 API 返回统一的 JSON 格式：

```typescript
{
    code: number;      // 0 表示成功，非 0 表示错误
    data?: any;        // 响应数据
    msg?: string;      // 提示信息
}
```

### HTTP 状态码

- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未认证
- `403` - 无权限
- `404` - 资源不存在
- `500` - 服务器错误

## 认证 API

### 注册

```http
POST /api/auth/register
```

**请求体：**

```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "SecurePass123!",
  "emailCode": "123456"  // 可选，如果启用邮箱验证
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "userId": "uuid",
    "username": "testuser",
    "email": "test@example.com"
  },
  "msg": "注册成功"
}
```

### 登录

```http
POST /api/auth/login
```

**请求体：**

```json
{
  "username": "testuser",
  "password": "SecurePass123!"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "sessionId": "session_token",
    "user": {
      "id": "uuid",
      "username": "testuser",
      "email": "test@example.com",
      "role": "user",
      "points": 1000
    }
  },
  "msg": "登录成功"
}
```

### 登出

```http
POST /api/auth/logout
```

**响应：**

```json
{
  "code": 0,
  "msg": "已登出"
}
```

### 获取当前用户

```http
GET /api/auth/session
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "username": "testuser",
    "email": "test@example.com",
    "role": "user",
    "points": 1000,
    "avatar": "/avatars/default.png"
  }
}
```

### 修改密码

```http
PUT /api/auth/password
```

**请求体：**

```json
{
  "oldPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**响应：**

```json
{
  "code": 0,
  "msg": "密码修改成功"
}
```

### 找回密码

```http
POST /api/auth/forgot-password
```

**请求体：**

```json
{
  "email": "test@example.com",
  "emailCode": "123456",
  "newPassword": "NewPass456!"
}
```

**响应：**

```json
{
  "code": 0,
  "msg": "密码重置成功"
}
```

## Canvas API

### 项目管理

#### 获取项目列表

```http
GET /api/canvas/projects?page=1&pageSize=20
```

**查询参数：**

- `page` - 页码（默认 1）
- `pageSize` - 每页数量（默认 20）

**响应：**

```json
{
  "code": 0,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "测试项目",
        "description": "项目描述",
        "createdAt": "2026-08-14T12:00:00Z",
        "updatedAt": "2026-08-14T13:00:00Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 创建项目

```http
POST /api/canvas/projects
```

**请求体：**

```json
{
  "name": "新项目",
  "description": "项目描述"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "projectId": "uuid",
    "name": "新项目",
    "createdAt": "2026-08-14T12:00:00Z"
  },
  "msg": "创建成功"
}
```

#### 更新项目

```http
PATCH /api/canvas/projects/:projectId
```

**请求体：**

```json
{
  "name": "更新的项目名",
  "description": "更新的描述"
}
```

**响应：**

```json
{
  "code": 0,
  "msg": "更新成功"
}
```

#### 删除项目

```http
DELETE /api/canvas/projects/:projectId
```

**响应：**

```json
{
  "code": 0,
  "msg": "删除成功"
}
```

### Canvas Drawing

#### 保存绘图

```http
POST /api/canvas/:projectId/drawings
```

**请求体：**

```json
{
  "drawingId": "drawing-001",
  "engine": "excalidraw",
  "snapshot": {
    "elements": [
      {
        "id": "elem-1",
        "type": "rectangle",
        "x": 100,
        "y": 100,
        "width": 200,
        "height": 150
      }
    ],
    "appState": {
      "viewBackgroundColor": "#ffffff"
    }
  }
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "documentId": "uuid",
    "revision": 1,
    "shapeCount": 1,
    "updatedAt": "2026-08-14T12:00:00Z"
  },
  "msg": "保存成功"
}
```

#### 获取绘图

```http
GET /api/canvas/:projectId/drawings/:drawingId
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "drawingId": "drawing-001",
    "engine": "excalidraw",
    "snapshot": {
      "elements": [...],
      "appState": {...}
    },
    "revision": 1,
    "shapeCount": 1,
    "pageCount": 1,
    "updatedAt": "2026-08-14T12:00:00Z"
  }
}
```

#### 获取版本历史

```http
GET /api/canvas/:projectId/drawings/:drawingId/versions?limit=10
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "versions": [
      {
        "id": "uuid",
        "revision": 2,
        "shapeCount": 3,
        "createdAt": "2026-08-14T13:00:00Z"
      },
      {
        "id": "uuid",
        "revision": 1,
        "shapeCount": 1,
        "createdAt": "2026-08-14T12:00:00Z"
      }
    ]
  }
}
```

### Canvas Script

#### 保存脚本

```http
POST /api/canvas/:projectId/scripts
```

**请求体：**

```json
{
  "scriptId": "script-001",
  "title": "剧本标题",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [{"type": "text", "text": "剧本内容"}]
      }
    ]
  }
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "documentId": "uuid",
    "revision": 1,
    "characterCount": 100,
    "wordCount": 50
  },
  "msg": "保存成功"
}
```

#### 获取脚本

```http
GET /api/canvas/:projectId/scripts/:scriptId
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "scriptId": "script-001",
    "title": "剧本标题",
    "content": {...},
    "markdown": "# 剧本标题\n\n剧本内容",
    "plainText": "剧本标题 剧本内容",
    "characterCount": 100,
    "wordCount": 50,
    "revision": 1
  }
}
```

### Canvas Skill

#### 执行 Skill

```http
POST /api/canvas/:projectId/skills/execute
```

**请求体：**

```json
{
  "skillId": "skill-001",
  "templateId": "image-generator",
  "parameters": {
    "prompt": "一只可爱的小猫",
    "size": "1024x1024"
  }
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "executionId": "uuid",
    "status": "running",
    "progress": 0
  },
  "msg": "开始执行"
}
```

#### 获取 Skill 状态

```http
GET /api/canvas/:projectId/skills/:skillId
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "skillId": "skill-001",
    "status": "success",
    "progress": 100,
    "output": {
      "imageUrl": "/assets/generated/image-001.png"
    },
    "lastExecutedAt": "2026-08-14T12:00:00Z"
  }
}
```

## 生成任务 API

### 图片生成

#### 创建图片生成任务

```http
POST /api/image-tasks
```

**请求体：**

```json
{
  "prompt": "A beautiful sunset over mountains",
  "model": "stable-diffusion-xl",
  "size": "1024x1024",
  "quantity": 2,
  "quality": "high",
  "negativePrompt": "blurry, low quality",
  "referenceImage": "asset-uuid"  // 可选，图生图
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "taskId": "uuid",
    "status": "pending",
    "estimatedTime": 30,
    "pointsCost": 40
  },
  "msg": "任务已创建"
}
```

#### 获取任务状态

```http
GET /api/image-tasks/:taskId
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "status": "completed",
    "progress": 100,
    "results": [
      {
        "url": "/assets/generated/image-001.png",
        "width": 1024,
        "height": 1024
      },
      {
        "url": "/assets/generated/image-002.png",
        "width": 1024,
        "height": 1024
      }
    ],
    "createdAt": "2026-08-14T12:00:00Z",
    "completedAt": "2026-08-14T12:00:30Z"
  }
}
```

#### 获取任务列表

```http
GET /api/image-tasks?status=completed&page=1&pageSize=20
```

**查询参数：**

- `status` - 任务状态（pending/running/completed/failed）
- `page` - 页码
- `pageSize` - 每页数量

**响应：**

```json
{
  "code": 0,
  "data": {
    "tasks": [...],
    "total": 50,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 重试失败任务

```http
POST /api/image-tasks/:taskId/retry
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "newTaskId": "uuid"
  },
  "msg": "已创建重试任务"
}
```

### 视频生成

#### 创建视频生成任务

```http
POST /api/video-tasks
```

**请求体：**

```json
{
  "prompt": "A bird flying in the sky",
  "duration": 5,
  "resolution": "1280x720",
  "fps": 30,
  "referenceImage": "asset-uuid"  // 可选，图生视频
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "taskId": "uuid",
    "status": "pending",
    "estimatedTime": 300,
    "pointsCost": 200
  },
  "msg": "任务已创建"
}
```

#### 获取任务状态

```http
GET /api/video-tasks/:taskId
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "status": "completed",
    "progress": 100,
    "result": {
      "url": "/assets/generated/video-001.mp4",
      "duration": 5,
      "width": 1280,
      "height": 720,
      "size": 10485760
    }
  }
}
```

### 音频生成

#### 创建音频生成任务

```http
POST /api/audio-tasks
```

**请求体：**

```json
{
  "text": "这是要转换的文本",
  "voice": "female-1",
  "speed": 1.0,
  "pitch": 0
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "taskId": "uuid",
    "status": "pending",
    "pointsCost": 10
  }
}
```

#### 获取任务状态

```http
GET /api/audio-tasks/:taskId
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "status": "completed",
    "result": {
      "url": "/assets/generated/audio-001.mp3",
      "duration": 15.5
    }
  }
}
```

## 计费 API

### 积分查询

#### 获取积分余额

```http
GET /api/points
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "balance": 1000,
    "freeQuota": 100,
    "paidPoints": 900
  }
}
```

#### 获取积分记录

```http
GET /api/points/history?page=1&pageSize=20&type=consume
```

**查询参数：**

- `type` - 类型（consume/recharge/refund）
- `page` - 页码
- `pageSize` - 每页数量

**响应：**

```json
{
  "code": 0,
  "data": {
    "records": [
      {
        "id": "uuid",
        "type": "consume",
        "amount": -20,
        "balance": 980,
        "reason": "图片生成",
        "createdAt": "2026-08-14T12:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### 商品管理

#### 获取商品列表

```http
GET /api/billing/products?type=points
```

**查询参数：**

- `type` - 商品类型（points/package）

**响应：**

```json
{
  "code": 0,
  "data": {
    "products": [
      {
        "id": "uuid",
        "name": "1000 积分",
        "type": "points",
        "price": 99,
        "points": 1000,
        "discount": 0.05,
        "onSale": true
      }
    ]
  }
}
```

### 订单管理

#### 创建订单

```http
POST /api/billing/orders
```

**请求体：**

```json
{
  "productId": "uuid",
  "quantity": 1,
  "couponCode": "DISCOUNT10"  // 可选
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "orderId": "uuid",
    "status": "pending",
    "totalAmount": 99,
    "discount": 10,
    "finalAmount": 89,
    "createdAt": "2026-08-14T12:00:00Z"
  },
  "msg": "订单创建成功"
}
```

#### 获取订单详情

```http
GET /api/billing/orders/:orderId
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "status": "paid",
    "product": {
      "name": "1000 积分",
      "type": "points"
    },
    "totalAmount": 99,
    "finalAmount": 89,
    "paidAt": "2026-08-14T12:05:00Z"
  }
}
```

#### 获取订单列表

```http
GET /api/billing/orders?status=paid&page=1
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "orders": [...],
    "total": 20,
    "page": 1,
    "pageSize": 20
  }
}
```

### 支付

#### 创建支付

```http
POST /api/billing/checkout
```

**请求体：**

```json
{
  "orderId": "uuid",
  "paymentMethod": "alipay"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "paymentUrl": "https://payment-gateway.com/pay?token=xxx",
    "qrCode": "data:image/png;base64,..."
  }
}
```

### 优惠券

#### 获取优惠券列表

```http
GET /api/billing/coupons
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "coupons": [
      {
        "id": "uuid",
        "code": "DISCOUNT10",
        "type": "percentage",
        "value": 0.1,
        "minAmount": 50,
        "expiresAt": "2026-12-31T23:59:59Z",
        "used": false
      }
    ]
  }
}
```

#### 兑换 CDK

```http
POST /api/cdk/redeem
```

**请求体：**

```json
{
  "code": "ABCD-EFGH-IJKL-MNOP"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "points": 500
  },
  "msg": "兑换成功，获得 500 积分"
}
```

## 素材 API

### 上传素材

```http
POST /api/library-assets
Content-Type: multipart/form-data
```

**请求体：**

```
file: <binary>
name: "图片名称"
description: "图片描述"
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "assetId": "uuid",
    "name": "图片名称",
    "type": "image",
    "url": "/assets/user/image-001.png",
    "size": 1048576,
    "createdAt": "2026-08-14T12:00:00Z"
  },
  "msg": "上传成功"
}
```

### 获取素材列表

```http
GET /api/library-assets?type=image&page=1&pageSize=20
```

**查询参数：**

- `type` - 素材类型（image/video/audio/text）
- `page` - 页码
- `pageSize` - 每页数量

**响应：**

```json
{
  "code": 0,
  "data": {
    "assets": [
      {
        "id": "uuid",
        "name": "图片名称",
        "type": "image",
        "url": "/assets/user/image-001.png",
        "thumbnail": "/assets/user/image-001-thumb.png",
        "size": 1048576,
        "createdAt": "2026-08-14T12:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### 删除素材

```http
DELETE /api/library-assets/:assetId
```

**响应：**

```json
{
  "code": 0,
  "msg": "删除成功"
}
```

## 管理后台 API

### 用户管理

#### 获取用户列表

```http
GET /api/admin/users?page=1&pageSize=20&role=user&status=active
```

**需要权限：** 管理员

**响应：**

```json
{
  "code": 0,
  "data": {
    "users": [
      {
        "id": "uuid",
        "username": "testuser",
        "email": "test@example.com",
        "role": "user",
        "status": "active",
        "points": 1000,
        "createdAt": "2026-08-01T00:00:00Z"
      }
    ],
    "total": 500,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 更新用户积分

```http
PATCH /api/admin/users/:userId/points
```

**请求体：**

```json
{
  "points": 1000,
  "reason": "管理员充值"
}
```

**响应：**

```json
{
  "code": 0,
  "msg": "积分更新成功"
}
```

### 生成记录管理

#### 获取生成记录

```http
GET /api/admin/generation-logs?status=failed&page=1
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "userId": "uuid",
        "username": "testuser",
        "type": "image",
        "model": "stable-diffusion-xl",
        "status": "failed",
        "error": "API 超时",
        "pointsCost": 20,
        "createdAt": "2026-08-14T12:00:00Z"
      }
    ],
    "total": 50
  }
}
```

#### 重试失败任务

```http
POST /api/admin/generation-logs/:logId/retry
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "newTaskId": "uuid"
  },
  "msg": "已创建重试任务"
}
```

### 系统设置

#### 获取站点配置

```http
GET /api/admin/settings/site
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "siteName": "VOZEB PRO",
    "siteUrl": "https://vozeb.com",
    "seoTitle": "AI 创作工作台",
    "seoDescription": "...",
    "logoUrl": "/logo.png"
  }
}
```

#### 更新站点配置

```http
PUT /api/admin/settings/site
```

**请求体：**

```json
{
  "siteName": "VOZEB PRO",
  "seoTitle": "AI 创作工作台"
}
```

**响应：**

```json
{
  "code": 0,
  "msg": "配置已更新"
}
```

## 错误码

### 通用错误码

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

### 业务错误码

| 错误码 | 说明 |
|--------|------|
| 1001 | 用户名已存在 |
| 1002 | 密码不符合要求 |
| 1003 | 用户名或密码错误 |
| 1004 | 邮箱已被使用 |
| 1005 | 验证码错误 |
| 1006 | 验证码已过期 |
| 2001 | 积分不足 |
| 2002 | 订单不存在 |
| 2003 | 订单状态错误 |
| 2004 | 优惠券无效 |
| 2005 | CDK 已被使用 |
| 3001 | 项目不存在 |
| 3002 | 无权访问项目 |
| 3003 | 文档不存在 |
| 4001 | 任务不存在 |
| 4002 | 任务状态错误 |
| 4003 | 生成失败 |
| 4004 | 模型不可用 |
| 5001 | 文件类型不支持 |
| 5002 | 文件大小超限 |
| 5003 | 素材不存在 |

## 使用示例

### JavaScript/TypeScript

```typescript
// 使用 fetch
async function createCanvasProject(name: string) {
    const response = await fetch('/api/canvas/projects', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',  // 包含 Cookie
        body: JSON.stringify({ name }),
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
        console.log('创建成功:', data.data);
    } else {
        console.error('创建失败:', data.msg);
    }
}
```

### cURL

```bash
# 注册
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Pass123!"}'

# 登录
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"testuser","password":"Pass123!"}'

# 创建项目（使用保存的 Cookie）
curl -X POST https://your-domain.com/api/canvas/projects \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Test Project"}'

# 上传文件
curl -X POST https://your-domain.com/api/library-assets \
  -b cookies.txt \
  -F "file=@/path/to/image.png" \
  -F "name=My Image"
```

### Python

```python
import requests

# 创建会话
session = requests.Session()

# 登录
response = session.post(
    'https://your-domain.com/api/auth/login',
    json={
        'username': 'testuser',
        'password': 'Pass123!'
    }
)

if response.json()['code'] == 0:
    print('登录成功')
    
    # 创建项目
    response = session.post(
        'https://your-domain.com/api/canvas/projects',
        json={'name': 'Test Project'}
    )
    
    print(response.json())
```

## 速率限制

为防止滥用，部分 API 有速率限制：

- 注册：10 次/小时/IP
- 登录：20 次/小时/IP
- 生成任务：100 次/小时/用户
- 文件上传：50 次/小时/用户

超过限制返回 429 状态码。

## Webhook

### 支付回调

```http
POST /api/billing/webhooks/:provider
```

第三方支付平台会向此端点发送支付结果通知。

### 生成完成回调

```http
POST /api/generation-webhooks/:channelId
```

外部 AI 服务完成生成后会向此端点发送结果通知。

## 变更日志

- **v0.0.6** (2026-08-14)
  - 添加 Canvas API
  - 添加 Skill 执行 API
  - 改进错误处理

## 相关文档

- [API 测试指南](./API_TESTING_GUIDE.md)
- [开发者文档](./DEVELOPER_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)
