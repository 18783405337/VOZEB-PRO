# API 测试指南

本文档提供 VOZEB PRO API 端点的完整测试示例和最佳实践。

## 目录

- [测试环境设置](#测试环境设置)
- [认证测试](#认证测试)
- [Canvas API 测试](#canvas-api-测试)
- [生成任务测试](#生成任务测试)
- [计费系统测试](#计费系统测试)
- [管理后台测试](#管理后台测试)
- [集成测试示例](#集成测试示例)

## 测试环境设置

### 安装依赖

```bash
cd web
pnpm install
```

### 环境变量

创建 `.env.test` 文件：

```env
DATABASE_URL=postgres://test_user:test_pass@localhost:5432/vozeb_test
VOZEB_PRO_ENCRYPTION_KEY=test_encryption_key_32_chars_long
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test canvas

# 监视模式
pnpm test --watch

# 生成覆盖率报告
pnpm test --coverage
```

## 认证测试

### 用户注册测试

```typescript
// src/app/api/auth/register/route.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";

describe("POST /api/auth/register", () => {
    it("应该成功注册新用户", async () => {
        const request = new Request("http://localhost:3000/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "testuser",
                email: "test@example.com",
                password: "SecurePass123!",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.code).toBe(0);
        expect(data.data).toHaveProperty("userId");
        expect(data.data).toHaveProperty("username", "testuser");
    });

    it("应该拒绝重复的用户名", async () => {
        // 首先注册一个用户
        await POST(createRequest({ username: "duplicate" }));

        // 尝试再次注册相同用户名
        const response = await POST(createRequest({ username: "duplicate" }));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe(1001);
        expect(data.msg).toContain("用户名已存在");
    });

    it("应该验证密码强度", async () => {
        const response = await POST(
            createRequest({ password: "weak" })
        );
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe(1002);
        expect(data.msg).toContain("密码不符合要求");
    });
});
```

### 用户登录测试

```typescript
// src/app/api/auth/login/route.test.ts
describe("POST /api/auth/login", () => {
    beforeEach(async () => {
        // 创建测试用户
        await createTestUser({
            username: "logintest",
            password: "Password123!",
        });
    });

    it("应该成功登录并返回 session", async () => {
        const request = new Request("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "logintest",
                password: "Password123!",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.code).toBe(0);
        expect(data.data).toHaveProperty("sessionId");
        expect(data.data.user).toHaveProperty("username", "logintest");
    });

    it("应该拒绝错误的密码", async () => {
        const response = await POST(
            createRequest({
                username: "logintest",
                password: "WrongPassword",
            })
        );
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.code).toBe(1003);
        expect(data.msg).toContain("用户名或密码错误");
    });

    it("应该记录登录时间和 IP", async () => {
        const response = await POST(
            createRequest({
                username: "logintest",
                password: "Password123!",
            })
        );

        const user = await getUserFromDatabase("logintest");
        expect(user.lastLoginAt).toBeDefined();
        expect(user.lastLoginIp).toBeDefined();
    });
});
```

## Canvas API 测试

### Canvas 项目管理测试

```typescript
// src/app/api/canvas/projects/route.test.ts
describe("Canvas Projects API", () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
        const { token, user } = await createAuthenticatedUser();
        authToken = token;
        userId = user.id;
    });

    describe("POST /api/canvas/projects", () => {
        it("应该创建新的 Canvas 项目", async () => {
            const request = createAuthRequest(authToken, {
                method: "POST",
                body: JSON.stringify({
                    name: "Test Canvas Project",
                    description: "Test description",
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.code).toBe(0);
            expect(data.data).toHaveProperty("projectId");
            expect(data.data.name).toBe("Test Canvas Project");
        });

        it("应该限制项目名称长度", async () => {
            const longName = "x".repeat(256);
            const response = await POST(
                createAuthRequest(authToken, {
                    body: JSON.stringify({ name: longName }),
                })
            );

            const data = await response.json();
            expect(response.status).toBe(400);
            expect(data.msg).toContain("名称过长");
        });
    });

    describe("GET /api/canvas/projects", () => {
        it("应该返回用户的所有项目", async () => {
            // 创建多个项目
            await createCanvasProject(userId, "Project 1");
            await createCanvasProject(userId, "Project 2");
            await createCanvasProject(userId, "Project 3");

            const request = createAuthRequest(authToken);
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.code).toBe(0);
            expect(data.data.projects).toHaveLength(3);
        });

        it("应该支持分页", async () => {
            const request = createAuthRequest(authToken, {
                url: "/api/canvas/projects?page=1&pageSize=10",
            });

            const response = await GET(request);
            const data = await response.json();

            expect(data.data).toHaveProperty("total");
            expect(data.data).toHaveProperty("page");
            expect(data.data).toHaveProperty("pageSize");
        });
    });
});
```

### Canvas Drawing 测试

```typescript
// src/app/api/canvas/[projectId]/route.test.ts
describe("Canvas Drawing API", () => {
    let projectId: string;
    let authToken: string;

    beforeEach(async () => {
        const { token, user } = await createAuthenticatedUser();
        authToken = token;
        const project = await createCanvasProject(user.id);
        projectId = project.id;
    });

    it("应该保存 Excalidraw 绘图数据", async () => {
        const drawingData = {
            engine: "excalidraw",
            drawingId: "drawing-001",
            snapshot: {
                elements: [
                    {
                        type: "rectangle",
                        id: "rect-1",
                        x: 100,
                        y: 100,
                        width: 200,
                        height: 150,
                    },
                ],
                appState: {
                    viewBackgroundColor: "#ffffff",
                },
            },
        };

        const request = createAuthRequest(authToken, {
            method: "POST",
            url: `/api/canvas/${projectId}`,
            body: JSON.stringify(drawingData),
        });

        const response = await POST(request, { params: { projectId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.code).toBe(0);
        expect(data.data.revision).toBe(1);
        expect(data.data.shapeCount).toBe(1);
    });

    it("应该支持版本历史", async () => {
        // 保存初始版本
        await saveDrawing(projectId, { elements: [] });

        // 保存更新版本
        const response = await saveDrawing(projectId, {
            elements: [{ type: "rectangle" }],
        });

        const data = await response.json();
        expect(data.data.revision).toBe(2);

        // 获取版本历史
        const historyResponse = await GET(
            createAuthRequest(authToken, {
                url: `/api/canvas/${projectId}/versions`,
            })
        );

        const historyData = await historyResponse.json();
        expect(historyData.data.versions).toHaveLength(2);
    });
});
```

### Canvas Skill 测试

```typescript
// src/app/api/canvas/skills/route.test.ts
describe("Canvas Skill API", () => {
    it("应该执行 Skill 并返回结果", async () => {
        const request = createAuthRequest(authToken, {
            method: "POST",
            url: "/api/canvas/skills/execute",
            body: JSON.stringify({
                skillId: "skill-001",
                templateId: "image-generator",
                projectId: "project-123",
                parameters: {
                    prompt: "A beautiful landscape",
                    size: "1024x1024",
                },
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.code).toBe(0);
        expect(data.data).toHaveProperty("executionId");
        expect(data.data.status).toBe("running");
    });

    it("应该记录执行历史", async () => {
        const skillId = await executeSkill(projectId, {
            template: "text-generator",
        });

        // 获取执行历史
        const request = createAuthRequest(authToken, {
            url: `/api/canvas/skills/${skillId}/history`,
        });

        const response = await GET(request);
        const data = await response.json();

        expect(data.code).toBe(0);
        expect(data.data.history).toBeInstanceOf(Array);
        expect(data.data.history[0]).toHaveProperty("executionTimeMs");
    });
});
```

## 生成任务测试

### 图片生成测试

```typescript
// src/app/api/image-tasks/route.test.ts
describe("Image Generation API", () => {
    it("应该创建图片生成任务", async () => {
        const request = createAuthRequest(authToken, {
            method: "POST",
            body: JSON.stringify({
                prompt: "A cute cat playing with yarn",
                model: "stable-diffusion-xl",
                size: "1024x1024",
                quantity: 2,
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.code).toBe(0);
        expect(data.data).toHaveProperty("taskId");
        expect(data.data.status).toBe("pending");
    });

    it("应该扣除用户积分", async () => {
        const beforePoints = await getUserPoints(userId);

        await createImageTask(userId, {
            prompt: "test",
            quantity: 2,
        });

        const afterPoints = await getUserPoints(userId);
        expect(afterPoints).toBeLessThan(beforePoints);
    });

    it("应该在失败时退还积分", async () => {
        const beforePoints = await getUserPoints(userId);

        const taskId = await createImageTask(userId, { prompt: "test" });
        await markTaskAsFailed(taskId);

        const afterPoints = await getUserPoints(userId);
        expect(afterPoints).toBe(beforePoints);
    });
});
```

### 视频生成测试

```typescript
// src/app/api/video-tasks/route.test.ts
describe("Video Generation API", () => {
    it("应该创建视频生成任务", async () => {
        const request = createAuthRequest(authToken, {
            method: "POST",
            body: JSON.stringify({
                prompt: "A bird flying in the sky",
                duration: 5,
                resolution: "1280x720",
                fps: 30,
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toHaveProperty("taskId");
        expect(data.data.estimatedTime).toBeGreaterThan(0);
    });

    it("应该支持图生视频", async () => {
        const imageAssetId = await uploadTestImage(userId);

        const response = await POST(
            createAuthRequest(authToken, {
                body: JSON.stringify({
                    prompt: "Make it move naturally",
                    referenceImage: imageAssetId,
                    duration: 3,
                }),
            })
        );

        const data = await response.json();
        expect(data.code).toBe(0);
        expect(data.data.taskType).toBe("image-to-video");
    });
});
```

### 任务状态查询测试

```typescript
// src/app/api/image-tasks/[id]/route.test.ts
describe("GET /api/image-tasks/:id", () => {
    it("应该返回任务详情", async () => {
        const task = await createImageTask(userId, { prompt: "test" });

        const request = createAuthRequest(authToken, {
            url: `/api/image-tasks/${task.id}`,
        });

        const response = await GET(request, { params: { id: task.id } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.id).toBe(task.id);
        expect(data.data).toHaveProperty("status");
        expect(data.data).toHaveProperty("progress");
    });

    it("应该返回生成结果", async () => {
        const task = await createAndCompleteImageTask(userId);

        const response = await GET(
            createAuthRequest(authToken, {
                url: `/api/image-tasks/${task.id}`,
            })
        );

        const data = await response.json();
        expect(data.data.status).toBe("completed");
        expect(data.data.results).toBeInstanceOf(Array);
        expect(data.data.results[0]).toHaveProperty("url");
    });
});
```

## 计费系统测试

### 订单创建测试

```typescript
// src/app/api/billing/orders/route.test.ts
describe("Billing Orders API", () => {
    it("应该创建积分订单", async () => {
        const request = createAuthRequest(authToken, {
            method: "POST",
            body: JSON.stringify({
                productId: "points-pack-1000",
                quantity: 1,
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toHaveProperty("orderId");
        expect(data.data.status).toBe("pending");
        expect(data.data.totalAmount).toBeGreaterThan(0);
    });

    it("应该应用优惠券", async () => {
        const coupon = await createCoupon(userId, {
            discount: 0.2, // 8折
            type: "percentage",
        });

        const response = await POST(
            createAuthRequest(authToken, {
                body: JSON.stringify({
                    productId: "points-pack-1000",
                    couponCode: coupon.code,
                }),
            })
        );

        const data = await response.json();
        expect(data.data.discount).toBeGreaterThan(0);
        expect(data.data.finalAmount).toBeLessThan(data.data.totalAmount);
    });
});
```

### 支付回调测试

```typescript
// src/app/api/billing/webhooks/[provider]/route.test.ts
describe("Payment Webhooks", () => {
    it("应该处理支付成功回调", async () => {
        const order = await createTestOrder(userId);

        const webhookPayload = {
            orderId: order.id,
            status: "paid",
            transactionId: "txn_123456",
            paidAmount: order.totalAmount,
            paidAt: new Date().toISOString(),
        };

        const request = new Request(
            "http://localhost:3000/api/billing/webhooks/alipay",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Webhook-Signature": generateSignature(webhookPayload),
                },
                body: JSON.stringify(webhookPayload),
            }
        );

        const response = await POST(request);
        expect(response.status).toBe(200);

        // 验证订单状态已更新
        const updatedOrder = await getOrder(order.id);
        expect(updatedOrder.status).toBe("paid");

        // 验证积分已发放
        const userPoints = await getUserPoints(userId);
        expect(userPoints).toBeGreaterThan(0);
    });

    it("应该拒绝重复的回调", async () => {
        const order = await createTestOrder(userId);
        const payload = { orderId: order.id, status: "paid" };

        // 第一次回调
        await POST(createWebhookRequest(payload));

        // 第二次相同回调
        const response = await POST(createWebhookRequest(payload));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.msg).toContain("已处理");
    });
});
```

## 管理后台测试

### 用户管理测试

```typescript
// src/app/api/admin/users/route.test.ts
describe("Admin Users API", () => {
    let adminToken: string;

    beforeEach(async () => {
        const admin = await createAdminUser();
        adminToken = admin.token;
    });

    it("应该列出所有用户", async () => {
        await createTestUser({ username: "user1" });
        await createTestUser({ username: "user2" });

        const request = createAuthRequest(adminToken, {
            url: "/api/admin/users?page=1&pageSize=20",
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.users.length).toBeGreaterThanOrEqual(2);
        expect(data.data).toHaveProperty("total");
    });

    it("应该更新用户积分", async () => {
        const user = await createTestUser();

        const request = createAuthRequest(adminToken, {
            method: "PATCH",
            url: `/api/admin/users/${user.id}/points`,
            body: JSON.stringify({
                points: 1000,
                reason: "管理员充值",
            }),
        });

        const response = await PATCH(request, { params: { id: user.id } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.code).toBe(0);

        const updatedUser = await getUserById(user.id);
        expect(updatedUser.points).toBe(1000);
    });
});
```

### 生成任务管理测试

```typescript
// src/app/api/admin/generation-logs/route.test.ts
describe("Admin Generation Logs API", () => {
    it("应该查询生成记录", async () => {
        const request = createAuthRequest(adminToken, {
            url: "/api/admin/generation-logs?status=failed&page=1",
        });

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toHaveProperty("logs");
        expect(data.data).toHaveProperty("total");
    });

    it("应该重试失败的任务", async () => {
        const failedTask = await createFailedTask(userId);

        const request = createAuthRequest(adminToken, {
            method: "POST",
            url: `/api/admin/generation-logs/${failedTask.id}/retry`,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.newTaskId).toBeDefined();
    });
});
```

## 集成测试示例

### 完整的生成流程测试

```typescript
// tests/integration/generation-workflow.test.ts
describe("Complete Generation Workflow", () => {
    it("应该完成从注册到生成的完整流程", async () => {
        // 1. 注册用户
        const registerResponse = await fetch(
            "http://localhost:3000/api/auth/register",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: "integrationtest",
                    email: "test@example.com",
                    password: "Test123!",
                }),
            }
        );
        const registerData = await registerResponse.json();
        expect(registerData.code).toBe(0);

        // 2. 登录
        const loginResponse = await fetch(
            "http://localhost:3000/api/auth/login",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: "integrationtest",
                    password: "Test123!",
                }),
            }
        );
        const loginData = await loginResponse.json();
        const token = loginData.data.sessionId;

        // 3. 充值积分
        const order = await createAndPayOrder(token, "points-pack-1000");
        expect(order.status).toBe("paid");

        // 4. 创建生成任务
        const taskResponse = await fetch(
            "http://localhost:3000/api/image-tasks",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    prompt: "A beautiful sunset",
                    quantity: 1,
                }),
            }
        );
        const taskData = await taskResponse.json();
        expect(taskData.code).toBe(0);

        // 5. 等待任务完成
        const finalStatus = await waitForTaskCompletion(taskData.data.taskId);
        expect(finalStatus.status).toBe("completed");
        expect(finalStatus.results.length).toBeGreaterThan(0);

        // 6. 验证积分扣除
        const pointsResponse = await fetch(
            "http://localhost:3000/api/points",
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        const pointsData = await pointsResponse.json();
        expect(pointsData.data.balance).toBeLessThan(1000);
    });
});
```

## 测试工具函数

```typescript
// tests/helpers/test-utils.ts

/**
 * 创建认证请求
 */
export function createAuthRequest(
    token: string,
    options: {
        method?: string;
        url?: string;
        body?: string;
    } = {}
) {
    const { method = "GET", url = "/", body } = options;

    return new Request(`http://localhost:3000${url}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body,
    });
}

/**
 * 创建测试用户
 */
export async function createTestUser(
    data: Partial<User> = {}
): Promise<{ user: User; token: string }> {
    const username = data.username || `user_${Date.now()}`;
    const password = data.password || "Test123!";

    // 注册
    const registerResponse = await fetch(
        "http://localhost:3000/api/auth/register",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                email: data.email || `${username}@test.com`,
                password,
            }),
        }
    );

    // 登录
    const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });

    const loginData = await loginResponse.json();
    return {
        user: loginData.data.user,
        token: loginData.data.sessionId,
    };
}

/**
 * 等待任务完成
 */
export async function waitForTaskCompletion(
    taskId: string,
    token: string,
    maxWaitMs: number = 60000
): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        const response = await fetch(
            `http://localhost:3000/api/image-tasks/${taskId}`,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        const data = await response.json();

        if (data.data.status === "completed" || data.data.status === "failed") {
            return data.data;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error("Task timeout");
}
```

## 最佳实践

1. **隔离测试数据**：每个测试使用独立的测试数据，避免相互影响
2. **清理测试数据**：测试完成后清理创建的数据
3. **模拟外部依赖**：使用 Mock 模拟第三方 API 调用
4. **测试边界条件**：测试正常情况、边界值和异常情况
5. **使用事务**：数据库测试使用事务，测试后自动回滚
6. **并行执行**：合理安排测试顺序，支持并行执行
7. **清晰的断言**：使用明确的断言信息，便于定位问题

## 运行特定测试套件

```bash
# 只运行认证相关测试
pnpm test auth

# 只运行 Canvas 相关测试
pnpm test canvas

# 只运行管理后台测试
pnpm test admin

# 运行集成测试
pnpm test integration
```

## 持续集成

在 CI 环境中运行测试：

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 22
          cache: "pnpm"

      - run: cd web && pnpm install
      - run: cd web && pnpm test
      - run: cd web && pnpm run typecheck
```

## 相关文档

- [功能测试清单](./TESTING_CHECKLIST.md)
- [部署文档](./DEPLOYMENT_GUIDE.md)
- [开发者指南](./DEVELOPER_GUIDE.md)
