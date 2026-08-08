# 专项供应商集成设计

## 1. 文档状态

- 日期：2026-08-08
- 状态：已确认
- 主工程：`D:\homeWork\saas-api\VOZEB-PRO`
- 参考工程：`D:\homeWork\曼居code\aigc-code`
- 选定方案：VOZEB-PRO 原生供应商适配
- 首批应用：数字人、`image_human`、动作迁移

## 2. 目标

在 VOZEB-PRO 内实现专项供应商渠道的统一管理、租户订阅和任务分发，同时尽量保持参考工程原有的供应商协议、业务参数、任务阶段和结果判断逻辑。

最终应满足：

1. 超级管理员可以配置多个物理供应商渠道。
2. 一个逻辑 API 可以映射一个或多个物理渠道。
3. 每个租户在每个专项应用下最多订阅一个逻辑 API。
4. 租户和最终用户不能获得供应商 Base URL、API Key 或渠道内部标识。
5. VOZEB-PRO 负责统一鉴权、租户隔离、计费、任务状态、结果持久化和审计。
6. VOZEB-PRO 直接调用供应商，不依赖参考工程在线运行。
7. 数字人、`image_human` 和动作迁移的外部请求与查询逻辑尽量兼容参考工程；数字人同时支持按渠道接入 Kling Avatar 等原生协议。

## 3. 非目标

本阶段不包含：

- 逐行翻译参考工程的 PHP 代码。
- 让 VOZEB-PRO 在运行时调用参考工程业务接口。
- 允许租户录入自己的供应商密钥或 Base URL。
- 一次性迁移所有专项供应商和所有历史任务。
- 为不同专项应用强行抽象完全相同的请求参数。
- 在首批实现中建设复杂的跨供应商自动熔断平台。

## 4. 保持原逻辑的边界

### 4.1 保持兼容的内容

以下逻辑以参考工程为准：

- 供应商请求路径和 HTTP 方法。
- Bearer Token 鉴权方式。
- 请求字段名称和业务默认值。
- 客户端任务号和幂等字段。
- 供应商任务 ID 提取规则。
- 供应商状态归一化规则。
- 结果媒体 URL 提取规则。
- 数字人的 TTS 与口型驱动两阶段流程。
- `image_human` 的主查询和兼容查询逻辑。
- 动作迁移的提交和查询协议。

### 4.2 使用 VOZEB-PRO 逻辑的内容

以下逻辑必须接入 VOZEB-PRO 现有体系：

- 用户、租户和权限校验。
- 应用安装、启停和租户订阅。
- 系统渠道密钥加密存储。
- 逻辑模型和物理渠道映射。
- 任务持久化、并发控制和 Worker 调度。
- 积分预扣、结算、退款和平台成本。
- 媒体资产、作品结果和对象存储。
- 操作日志、错误日志和健康检查。

## 5. 总体架构

```text
超级管理员
  -> 系统物理渠道
      -> 逻辑 API
          -> 租户应用单一订阅
              -> 专项任务服务
                  -> 专项 Provider Adapter
                      -> 外部供应商 API
                  -> Worker 查询与推进
                  -> 媒体持久化
                  -> 计费结算或退款
```

### 5.1 物理渠道

复用 VOZEB-PRO 的 `systemChannels`：

- `id`
- 渠道名称
- Provider 类型
- Base URL
- 加密 API Key
- 协议类型
- 创建与查询路径
- 启用状态
- 高级配置

Base URL 和 API Key 只允许平台管理员写入，只能在服务端解密使用。

### 5.2 逻辑 API

复用并扩展 VOZEB-PRO 的 `logicalModels`。首批逻辑能力建议使用：

- `digital-human`
- `image-human`
- `action-transfer`

逻辑 API 负责描述租户可订阅的业务能力，不直接暴露物理供应商。一个逻辑 API 可以映射多个系统渠道，并保存：

- 渠道优先级
- Provider 模型名
- 启用状态
- 成本规则
- 应用能力声明

### 5.3 租户应用订阅

新增关系表 `tenant_app_provider_bindings`，不把关键关系仅保存在 `tenant_app_settings.settings_json` 中。

建议字段：

```sql
tenant_app_provider_bindings (
    id text primary key,
    tenant_app_id text not null references tenant_apps(id) on delete cascade,
    logical_model_key text not null,
    status text not null,
    bound_by text not null references users(id),
    created_at bigint not null,
    updated_at bigint not null,
    unique (tenant_app_id)
)
```

`UNIQUE (tenant_app_id)` 保证每个租户的每个专项应用最多只有一个逻辑 API 订阅。

保存绑定时必须验证：

1. 应用已经安装并启用。
2. 逻辑 API 已发布并启用。
3. 逻辑 API 声明支持当前应用。
4. 当前操作者具有 `tenant.apps.configure` 权限。
5. 绑定内容不包含 Base URL、API Key 或供应商密钥引用。

## 6. 渠道解析与分发

任务创建时按以下顺序解析：

1. 根据请求上下文确定租户。
2. 校验专项应用已安装并启用。
3. 读取该 `tenant_app_id` 的唯一逻辑 API 绑定。
4. 获取逻辑 API 对应的启用渠道列表。
5. 按优先级和可用状态选择物理渠道。
6. 服务端解密渠道密钥。
7. 创建本地任务并保存渠道与定价快照。
8. Worker 通过对应 Provider Adapter 提交外部任务。

租户只订阅逻辑 API。物理渠道可以由平台管理员替换或调整优先级，而不需要租户重新配置。

首批实现采用确定性优先级选择：

- 仅选择启用渠道。
- 优先级数值越小越优先。
- 同优先级按渠道 ID 稳定排序。
- 提交前失败可以选择下一渠道。
- 供应商已经返回任务 ID 后，不允许切换渠道。

## 7. Provider Adapter

专项 Provider Adapter 使用统一最小接口，但允许各应用保留独立状态机：

```ts
interface SpecializedProviderAdapter<TInput, TState> {
    submit(context: ProviderContext, input: TInput): Promise<ProviderSubmission<TState>>;
    query(context: ProviderContext, state: TState): Promise<ProviderQueryResult<TState>>;
}
```

`ProviderContext` 由服务端构造，包含：

- 渠道 ID
- Provider 类型
- Base URL
- 已解密 API Key
- 请求超时
- 本地任务 ID
- 客户端幂等键

Adapter 不负责：

- 读取浏览器传入的密钥。
- 判断租户权限。
- 扣减或退还积分。
- 直接写入租户账本。
- 决定租户应用订阅。

## 8. 数字人

### 8.1 渠道协议

数字人业务层不固定供应商协议。物理渠道必须声明数字人协议标识，首批支持：

- `xhadmin-digital-human-v1`：保持参考工程的 TTS + Lipsync 两阶段链路。
- `kling-avatar-v1`：参考 Kling AI 官方 Avatar API，由 Kling Adapter 负责提交、查询、状态和结果转换。

租户仍只选择逻辑 API，不感知渠道协议。逻辑路由选中物理渠道后，运行时按渠道协议创建对应 Adapter。

Kling 官方参考：`https://klingai.com/document-api/api/video/avatar`

Kling Avatar 与 TTS 在官方能力导航中是独立接口。实现时不得假设其请求字段、鉴权或任务状态与 Xhadmin 相同，必须由独立 Adapter 和官方协议测试固定契约。

### 8.2 Xhadmin 参考协议

- TTS 提交：`POST /api/v1/apps/voice_tts/tts_live`
- 声音克隆：`POST /api/v1/apps/voice_tts/clone_voice`
- 口型驱动提交：`POST /api/v1/apps/lipsync/submit`
- 任务查询：`GET /api/v1/tasks/{task_id}`

### 8.3 状态机

Xhadmin 两阶段协议：

```text
queued
  -> submitting_tts
  -> waiting_tts
  -> submitting_lipsync
  -> waiting_lipsync
  -> persisting_result
  -> succeeded
```

Kling Avatar 协议：

```text
queued
  -> submitting_avatar
  -> waiting_avatar
  -> persisting_result
  -> succeeded
```

如果 Kling 渠道配置为先调用官方 TTS 再提交 Avatar，则中间阶段保存在 `provider_state_json`，但业务任务仍使用统一数字人状态和最终结果结构。

任一阶段都可以进入 `failed` 或 `cancelled`。

任务需要保存：

- 本地任务 ID
- Provider 协议标识
- TTS Provider Task ID
- Lipsync Provider Task ID
- Avatar Provider Task ID
- 当前 Provider 阶段
- 渠道快照
- 请求快照
- 最后一次查询结果摘要
- 音频中间产物
- 最终视频结果
- 重试次数与下次查询时间

### 8.4 兼容原则

- 保留参考工程对多种响应结构的任务 ID 提取。
- 保留对状态字段和结果 URL 的兼容解析。
- 保留 `client_task_id`、`idempotency_key`、`local_task_id` 和 `local_task_sn`。
- Xhadmin Provider 返回音频后再提交口型驱动，不在一个请求中假设全部完成。
- Kling Adapter 按官方 Avatar API 独立映射输入、提交、查询和结果，不复用 Xhadmin 的字段拼装。
- Adapter 输出统一的 `submitted`、`processing`、`succeeded`、`failed` 状态和标准媒体结果。
- 供应商结果必须进入 VOZEB-PRO 媒体资产后才能标记最终成功。

## 9. Image Human

### 9.1 原协议

- 提交：`POST /api/v1/apps/image_human/submit`
- 查询：`POST /api/v1/apps/image_human/query`
- 兼容查询：`GET /api/v1/tasks/{task_id}`

兼容查询仅用于符合参考工程条件的 `task_` 前缀任务。

### 9.2 请求字段

保持参考工程字段语义：

- `file_url`
- `ref_file_url`
- `script_text`
- `prompt`
- `duration`
- `mode`
- 幂等与本地任务字段

提交前必须校验输入媒体是供应商可访问的 HTTPS URL。仅本机路径、内网地址或临时浏览器 URL 不得提交。

### 9.3 状态机

```text
queued
  -> submitting
  -> waiting_provider
  -> persisting_result
  -> succeeded
```

## 10. 动作迁移

### 10.1 原协议

- 提交：`POST /api/v1/apps/action_transfer/submit`
- 查询：`POST /api/v1/apps/action_transfer/query`
- 请求中保留 `type = action_transfer`

### 10.2 状态机

```text
queued
  -> submitting
  -> waiting_provider
  -> persisting_result
  -> succeeded
```

提交参数、状态判断和视频结果提取优先与参考工程保持一致。

## 11. 任务数据

现有专项任务表需要补充统一的供应商执行字段，字段名可按具体表调整：

- `logical_model_key`
- `channel_id`
- `provider`
- `provider_stage`
- `provider_task_id`
- `provider_secondary_task_id`
- `provider_state_json`
- `request_snapshot_json`
- `pricing_snapshot_json`
- `attempt_count`
- `next_poll_at`
- `lease_owner`
- `lease_expires_at`
- `last_error_code`
- `last_error_message`

不将完整 API Key、Authorization Header 或未经筛选的供应商响应写入任务表。

## 12. Worker 设计

专项任务继续由 VOZEB-PRO Worker 推进。Worker 必须支持：

- 原子领取任务。
- 租约到期后重新领取。
- 按 `next_poll_at` 控制查询频率。
- 提交阶段幂等。
- 查询阶段指数退避。
- 明确区分临时错误和永久错误。
- 单任务锁定已提交渠道。
- 服务重启后从数据库状态继续执行。

Provider 已返回任务 ID 后，即使当前渠道被管理员停用，也允许该任务继续查询；停用只阻止新任务提交。

## 13. 计费

任务提交前生成不可变定价快照：

- 租户销售单价
- 平台供应商成本
- 计费单位
- 收款模式
- 逻辑 API
- 物理渠道

结算规则：

1. 创建任务时预扣或冻结租户积分。
2. 外部提交成功不等于最终结算成功。
3. 最终结果持久化成功后完成结算。
4. 永久失败或取消时按现有账本能力退款。
5. 中间阶段已经产生的供应商成本可以记录平台成本，但不得静默扩大租户收费。
6. 重试不得重复扣费。

## 14. 安全

- API Key 使用现有系统渠道加密机制存储。
- 管理接口返回时始终脱敏。
- 租户接口不返回物理渠道 ID、Base URL 或 Provider 原始配置。
- 服务端忽略客户端传入的渠道、Base URL 和密钥字段。
- 供应商错误响应进入日志前进行敏感字段清理。
- 媒体 URL 校验协议、主机和可访问性，防止 SSRF。
- 所有任务查询必须同时校验租户 ID 和任务 ID。

## 15. 管理界面

### 15.1 超级管理员

在现有系统渠道和逻辑模型管理中增加专项能力配置：

- 渠道支持的专项应用。
- 逻辑 API 到渠道的映射。
- 渠道优先级。
- Provider 模型或规格。
- 成本规则。
- 渠道启停和测试连接。

### 15.2 租户管理员

在租户应用配置中增加 API 订阅项：

- 只展示当前应用可用的逻辑 API。
- 单选，不允许多选。
- 不展示物理供应商和密钥。
- 未绑定时禁止创建真实供应商任务，并给出明确配置提示。

## 16. 错误与兼容策略

统一错误类型：

- `APP_NOT_INSTALLED`
- `APP_DISABLED`
- `PROVIDER_NOT_BOUND`
- `LOGICAL_API_DISABLED`
- `CHANNEL_UNAVAILABLE`
- `PROVIDER_AUTH_FAILED`
- `PROVIDER_REQUEST_INVALID`
- `PROVIDER_TEMPORARY_FAILURE`
- `PROVIDER_TASK_FAILED`
- `PROVIDER_RESPONSE_INVALID`
- `MEDIA_PERSIST_FAILED`

外部响应解析应宽容，内部状态写入应严格。无法识别的供应商响应不能直接判定成功，必须记录为可诊断错误。

## 17. 实施顺序

### 阶段 1：渠道绑定基础设施

- 新增租户应用 Provider 绑定表。
- 增加 repository、service 和权限接口。
- 扩展逻辑 API 与专项应用能力映射。
- 增加超级管理员和租户配置界面。

### 阶段 2：数字人真实供应商

- 增加数字人 Adapter 接口和协议解析器。
- 实现 `xhadmin-digital-human-v1` Adapter。
- 实现 `kling-avatar-v1` Adapter。
- 扩展数字人任务状态机。
- 接入 Xhadmin TTS/Lipsync 与 Kling Avatar。
- 接入媒体持久化、计费和退款。

### 阶段 3：Image Human

- 增加 `image_human` 任务、结果和 Adapter。
- 接入 HTTPS 媒体输入校验。
- 接入查询兼容逻辑。

### 阶段 4：动作迁移

- 增加动作迁移任务、结果和 Adapter。
- 接入提交、查询和视频持久化。

### 阶段 5：联调与灰度

- 供应商沙箱联调。
- 超时、重试、退款和服务重启测试。
- 单租户灰度。
- 多租户隔离验收。

## 18. 验收标准

1. 超级管理员能维护多个专项供应商渠道。
2. 超级管理员能将逻辑 API 映射到一个或多个渠道。
3. 每个租户应用只能保存一个逻辑 API 订阅。
4. 租户无法读取供应商密钥和物理地址。
5. 未安装、未启用或未绑定应用不能创建真实任务。
6. 数字人能够按渠道完成 Xhadmin TTS/Lipsync 或 Kling Avatar 的完整恢复型状态机。
7. `image_human` 和动作迁移能够完成提交、查询和结果持久化。
8. Worker 重启后能继续推进未完成任务。
9. 重试不会重复扣费或重复创建本地结果。
10. 失败和取消任务能够按定价快照正确退款。
11. 所有任务和结果查询均符合租户隔离。
12. 单元测试、集成测试、Lint、生产构建和本地部署检查全部通过。

## 19. 设计结论

采用 VOZEB-PRO 原生供应商适配。参考工程作为供应商协议和业务规则基准，不作为运行时依赖。

首批实现先建设统一渠道订阅和分发基础设施，再按数字人、`image_human`、动作迁移的顺序迁移。对外协议尽量保持原逻辑，对内统一接入 VOZEB-PRO 的 SaaS、Worker、媒体和计费体系。
