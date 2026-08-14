# Canvas Drawing API 设计文档

**版本**: 1.0  
**创建日期**: 2026-08-14  
**基础路径**: `/api/canvas/:projectId/drawings`

---

## 📋 API 端点列表

### Drawing 文档管理

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/canvas/:projectId/drawings` | 创建绘图文档 | ✅ |
| GET | `/api/canvas/:projectId/drawings` | 列出项目绘图 | ✅ |
| GET | `/api/canvas/:projectId/drawings/:drawingId` | 获取绘图详情 | ✅ |
| PUT | `/api/canvas/:projectId/drawings/:drawingId` | 更新绘图文档 | ✅ |
| DELETE | `/api/canvas/:projectId/drawings/:drawingId` | 删除绘图文档 | ✅ |

### 版本管理

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/canvas/:projectId/drawings/:drawingId/versions` | 获取版本历史 | ✅ |
| GET | `/api/canvas/:projectId/drawings/:drawingId/versions/:revision` | 获取特定版本 | ✅ |
| POST | `/api/canvas/:projectId/drawings/:drawingId/restore` | 恢复到指定版本 | ✅ |

### 预览和导出

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/canvas/:projectId/drawings/:drawingId/preview` | 生成预览图 | ✅ |
| POST | `/api/canvas/:projectId/drawings/:drawingId/export` | 导出为图片 | ✅ |

---

## 🔧 API 详细设计

### 1. 创建绘图文档

**端点**: `POST /api/canvas/:projectId/drawings`

**请求体**:
```typescript
{
  drawingId: string;        // 客户端生成的唯一ID
  engine: "excalidraw" | "tldraw";
  snapshot: any;            // 绘图数据
  shapeCount?: number;
  pageCount?: number;
}
```

**响应** (201 Created):
```typescript
{
  id: string;
  projectId: string;
  drawingId: string;
  engine: string;
  revision: number;
  shapeCount: number;
  pageCount: number;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**错误响应**:
- `400 Bad Request`: 无效的请求数据
- `401 Unauthorized`: 未认证
- `403 Forbidden`: 无权限访问项目
- `409 Conflict`: drawingId 已存在

**示例**:
```bash
curl -X POST https://api.example.com/api/canvas/proj-123/drawings \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "drawingId": "drawing-abc123",
    "engine": "tldraw",
    "snapshot": {...},
    "shapeCount": 5,
    "pageCount": 1
  }'
```

---

### 2. 列出项目绘图

**端点**: `GET /api/canvas/:projectId/drawings`

**查询参数**:
```typescript
{
  page?: number;           // 页码，默认 1
  limit?: number;          // 每页数量，默认 20，最大 100
  engine?: "excalidraw" | "tldraw";  // 按引擎筛选
  sortBy?: "updatedAt" | "createdAt"; // 排序字段
  order?: "asc" | "desc";  // 排序顺序，默认 desc
}
```

**响应** (200 OK):
```typescript
{
  drawings: Array<{
    id: string;
    drawingId: string;
    engine: string;
    revision: number;
    shapeCount: number;
    pageCount: number;
    previewUrl: string | null;
    updatedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**示例**:
```bash
curl https://api.example.com/api/canvas/proj-123/drawings?page=1&limit=10 \
  -H "Authorization: Bearer TOKEN"
```

---

### 3. 获取绘图详情

**端点**: `GET /api/canvas/:projectId/drawings/:drawingId`

**查询参数**:
```typescript
{
  includeSnapshot?: boolean;  // 是否包含完整 snapshot，默认 true
  includeVersions?: boolean;  // 是否包含版本列表，默认 false
}
```

**响应** (200 OK):
```typescript
{
  id: string;
  projectId: string;
  drawingId: string;
  engine: string;
  snapshot?: any;           // 根据 includeSnapshot
  revision: number;
  shapeCount: number;
  pageCount: number;
  previewUrl: string | null;
  renderUrl: string | null;
  renderMetadata: any | null;
  createdAt: string;
  updatedAt: string;
  versions?: Array<{        // 根据 includeVersions
    revision: number;
    shapeCount: number;
    createdAt: string;
  }>;
}
```

**错误响应**:
- `404 Not Found`: 绘图不存在

**示例**:
```bash
curl https://api.example.com/api/canvas/proj-123/drawings/drawing-abc123 \
  -H "Authorization: Bearer TOKEN"
```

---

### 4. 更新绘图文档

**端点**: `PUT /api/canvas/:projectId/drawings/:drawingId`

**请求体**:
```typescript
{
  snapshot: any;            // 新的绘图数据
  shapeCount?: number;
  pageCount?: number;
  createVersion?: boolean;  // 是否创建版本历史，默认 true
}
```

**响应** (200 OK):
```typescript
{
  id: string;
  projectId: string;
  drawingId: string;
  revision: number;         // 递增
  shapeCount: number;
  pageCount: number;
  previewUrl: string | null;
  updatedAt: string;
}
```

**错误响应**:
- `404 Not Found`: 绘图不存在
- `409 Conflict`: 并发冲突（基于 revision）

**示例**:
```bash
curl -X PUT https://api.example.com/api/canvas/proj-123/drawings/drawing-abc123 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot": {...},
    "shapeCount": 10,
    "createVersion": true
  }'
```

---

### 5. 删除绘图文档

**端点**: `DELETE /api/canvas/:projectId/drawings/:drawingId`

**响应** (204 No Content)

**错误响应**:
- `404 Not Found`: 绘图不存在

**示例**:
```bash
curl -X DELETE https://api.example.com/api/canvas/proj-123/drawings/drawing-abc123 \
  -H "Authorization: Bearer TOKEN"
```

---

### 6. 获取版本历史

**端点**: `GET /api/canvas/:projectId/drawings/:drawingId/versions`

**查询参数**:
```typescript
{
  limit?: number;          // 返回版本数，默认 10，最大 50
}
```

**响应** (200 OK):
```typescript
{
  versions: Array<{
    revision: number;
    shapeCount: number;
    pageCount: number;
    description: string | null;
    createdAt: string;
  }>;
}
```

**示例**:
```bash
curl https://api.example.com/api/canvas/proj-123/drawings/drawing-abc123/versions \
  -H "Authorization: Bearer TOKEN"
```

---

### 7. 获取特定版本

**端点**: `GET /api/canvas/:projectId/drawings/:drawingId/versions/:revision`

**响应** (200 OK):
```typescript
{
  revision: number;
  snapshot: any;
  shapeCount: number;
  pageCount: number;
  description: string | null;
  createdAt: string;
}
```

**示例**:
```bash
curl https://api.example.com/api/canvas/proj-123/drawings/drawing-abc123/versions/5 \
  -H "Authorization: Bearer TOKEN"
```

---

### 8. 恢复到指定版本

**端点**: `POST /api/canvas/:projectId/drawings/:drawingId/restore`

**请求体**:
```typescript
{
  revision: number;        // 要恢复的版本号
}
```

**响应** (200 OK):
```typescript
{
  id: string;
  revision: number;        // 新的版本号
  restoredFrom: number;    // 恢复自哪个版本
  updatedAt: string;
}
```

**示例**:
```bash
curl -X POST https://api.example.com/api/canvas/proj-123/drawings/drawing-abc123/restore \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"revision": 5}'
```

---

### 9. 生成预览图

**端点**: `POST /api/canvas/:projectId/drawings/:drawingId/preview`

**请求体**:
```typescript
{
  width?: number;          // 默认 300
  height?: number;         // 默认 225
  format?: "png" | "jpeg" | "webp";  // 默认 png
  quality?: number;        // 0-1，默认 0.9
}
```

**响应** (200 OK):
```typescript
{
  previewUrl: string;      // 预览图 URL
  size: number;            // 文件大小（字节）
  format: string;
}
```

**示例**:
```bash
curl -X POST https://api.example.com/api/canvas/proj-123/drawings/drawing-abc123/preview \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "width": 600,
    "height": 450,
    "format": "webp"
  }'
```

---

### 10. 导出为图片

**端点**: `POST /api/canvas/:projectId/drawings/:drawingId/export`

**请求体**:
```typescript
{
  format: "png" | "svg" | "jpeg";
  width?: number;
  height?: number;
  scale?: number;          // 默认 2
  background?: string;     // 默认 #ffffff
  padding?: number;        // 默认 20
}
```

**响应** (200 OK):
```typescript
{
  exportUrl: string;       // 导出文件 URL（临时）
  expiresAt: string;       // URL 过期时间
  size: number;
  format: string;
}
```

**示例**:
```bash
curl -X POST https://api.example.com/api/canvas/proj-123/drawings/drawing-abc123/export \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "png",
    "scale": 2,
    "background": "#f0f0f0"
  }'
```

---

## 🔒 认证和授权

### 认证
所有端点需要 Bearer Token:
```
Authorization: Bearer <access_token>
```

### 授权检查
1. 用户必须是项目成员
2. 只能访问自己创建的绘图（通过 user_id）
3. 管理员可以访问项目的所有绘图

---

## 📊 速率限制

| 端点类型 | 限制 |
|---------|------|
| 读取 (GET) | 100 req/min |
| 写入 (POST/PUT) | 30 req/min |
| 删除 (DELETE) | 10 req/min |
| 导出 | 10 req/min |

超过限制返回 `429 Too Many Requests`

---

## 🎯 错误响应格式

统一的错误响应格式：

```typescript
{
  error: {
    code: string;          // 错误代码
    message: string;       // 错误消息
    details?: any;         // 详细信息（可选）
  }
}
```

### 错误代码列表

| Code | HTTP Status | 说明 |
|------|-------------|------|
| `UNAUTHORIZED` | 401 | 未认证 |
| `FORBIDDEN` | 403 | 无权限 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 冲突（如 ID 重复） |
| `VALIDATION_ERROR` | 400 | 请求数据无效 |
| `RATE_LIMIT_EXCEEDED` | 429 | 超过速率限制 |
| `INTERNAL_ERROR` | 500 | 服务器错误 |

---

## 🧪 测试用例

### 创建和获取绘图
```bash
# 1. 创建绘图
DRAWING_ID=$(curl -X POST http://localhost:3000/api/canvas/proj-123/drawings \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"drawingId":"test-001","engine":"tldraw","snapshot":{}}' \
  | jq -r '.drawingId')

# 2. 获取绘图
curl http://localhost:3000/api/canvas/proj-123/drawings/$DRAWING_ID \
  -H "Authorization: Bearer TOKEN"
```

### 更新和版本
```bash
# 3. 更新绘图
curl -X PUT http://localhost:3000/api/canvas/proj-123/drawings/$DRAWING_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"snapshot":{},"shapeCount":5}'

# 4. 查看版本历史
curl http://localhost:3000/api/canvas/proj-123/drawings/$DRAWING_ID/versions \
  -H "Authorization: Bearer TOKEN"
```

---

## 📝 实施清单

### Phase 1: 基础 CRUD
- [ ] POST /drawings (创建)
- [ ] GET /drawings (列表)
- [ ] GET /drawings/:id (详情)
- [ ] PUT /drawings/:id (更新)
- [ ] DELETE /drawings/:id (删除)

### Phase 2: 版本管理
- [ ] GET /drawings/:id/versions
- [ ] GET /drawings/:id/versions/:revision
- [ ] POST /drawings/:id/restore

### Phase 3: 预览和导出
- [ ] POST /drawings/:id/preview
- [ ] POST /drawings/:id/export

### Phase 4: 优化
- [ ] 速率限制
- [ ] 缓存策略
- [ ] 性能监控

---

**文档版本**: 1.0  
**最后更新**: 2026-08-14  
**下次审查**: 实施后
