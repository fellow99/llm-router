# LLM-Router 整体测试用例

> 生成时间: 2026-05-11 | 基于 Go 参考项目规格适配 TypeScript/Express 实现

## 1. 配置模块测试 (001-config-module)

### TC-CFG-001: JSON 配置文件加载

- **前置条件**: 存在有效的 `config.json` 文件
- **步骤**: 启动应用，传入 `--config config.json`
- **预期结果**: 配置正确加载，所有后端、别名、端口配置生效
- **优先级**: P1

### TC-CFG-002: YAML 配置文件加载

- **前置条件**: 存在有效的 `config.yaml` 文件
- **步骤**: 启动应用，传入 `--config config.yaml`
- **预期结果**: 配置正确加载，与等效 JSON 配置产生相同结果
- **优先级**: P1

### TC-CFG-003: JSONC 配置（带注释的 JSON）

- **前置条件**: 配置文件包含 JSON 注释
- **步骤**: 启动应用，传入 JSONC 配置路径
- **预期结果**: 注释被正确忽略，配置正常加载
- **优先级**: P2

### TC-CFG-004: 配置文件不存在

- **前置条件**: 无配置文件
- **步骤**: 启动应用，不指定配置路径
- **预期结果**: 使用硬编码默认配置，服务正常启动
- **优先级**: P1

### TC-CFG-005: Zod 配置验证失败

- **前置条件**: 配置文件包含无效数据（如缺少必填字段）
- **步骤**: 启动应用，传入无效配置
- **预期结果**: 输出详细验证错误信息，进程退出码非零
- **优先级**: P1

### TC-CFG-006: 配置优先级

- **前置条件**: 配置文件设置端口 11411，环境变量设置 8080
- **步骤**: 启动应用
- **预期结果**: 环境变量优先，实际监听端口为 8080
- **优先级**: P1

### TC-CFG-007: 自动生成 API 密钥

- **前置条件**: 未配置 LLMROUTER_API_KEY 环境变量
- **步骤**: 启动应用
- **预期结果**: 自动生成 `rsk_` 前缀密钥，打印到控制台
- **优先级**: P1

---

## 2. 代理模块测试 (002-proxy-module)

### TC-PRX-001: 前缀路由匹配

- **前置条件**: 配置了 `openai/` 前缀指向 OpenAI 后端
- **步骤**: 发送 `model: "openai/gpt-4o-mini"` 请求
- **预期结果**: 请求路由到 OpenAI 后端
- **优先级**: P1

### TC-PRX-002: 模型前缀移除

- **前置条件**: 配置了 `openai/` 前缀
- **步骤**: 发送 `model: "openai/gpt-4o-mini"` 请求
- **预期结果**: 转发给后端的模型名为 `gpt-4o-mini`（前缀已移除）
- **优先级**: P1

### TC-PRX-003: 后端认证注入

- **前置条件**: 后端配置了 `require_api_key: true` 和 `api_key: "${env:OPENAI_API_KEY}"`
- **步骤**: 发送请求到该后端
- **预期结果**: 请求头包含 `Authorization: Bearer <OPENAI_API_KEY>`
- **优先级**: P1

### TC-PRX-004: 后端认证移除

- **前置条件**: 后端配置了 `require_api_key: false`
- **步骤**: 发送请求到该后端（携带客户端 Authorization 头）
- **预期结果**: 转发请求中移除 Authorization 头
- **优先级**: P1

### TC-PRX-005: 无匹配后端

- **前置条件**: 请求模型无前缀匹配，无默认后端
- **步骤**: 发送 `model: "unknown-model"` 请求
- **预期结果**: 返回 `502 Bad Gateway`
- **优先级**: P1

### TC-PRX-006: 默认后端路由

- **前置条件**: 配置了默认后端（`default: true`）
- **步骤**: 发送 `model: "gpt-4o-mini"` 请求（无前缀）
- **预期结果**: 请求路由到默认后端
- **优先级**: P1

### TC-PRX-007: SSE 流式响应

- **前置条件**: 发送 `stream: true` 请求
- **步骤**: 发送流式请求
- **预期结果**: 响应 Content-Type 为 `text/event-stream`，逐 chunk 转发
- **优先级**: P1

---

## 3. 请求处理模块测试 (003-handler-module)

### TC-HDL-001: 模型别名展开

- **前置条件**: 配置别名 `"glm5.1": "baidu/glm5.1"`
- **步骤**: 发送 `model: "glm5.1"` 请求
- **预期结果**: 别名展开为 `baidu/glm5.1`，路由到 baidu 后端
- **优先级**: P1

### TC-HDL-002: 角色重写

- **前置条件**: baidu 后端配置了 `"developer": "system"` 角色重写
- **步骤**: 发送 `messages: [{role: "developer", content: "..."}]` 请求到 baidu 后端
- **预期结果**: 转发请求中角色变为 `"system"`
- **优先级**: P1

### TC-HDL-003: 参数过滤

- **前置条件**: 后端配置了 `unsupported_params: ["reasoning_effort"]`
- **步骤**: 发送包含 `reasoning_effort: 5` 的请求到该后端
- **预期结果**: 转发请求中移除了 `reasoning_effort` 参数
- **优先级**: P2

### TC-HDL-004: Bearer Token 认证成功

- **前置条件**: 配置了有效的 `LLMROUTER_API_KEY`
- **步骤**: 发送请求携带正确 `Authorization: Bearer <key>`
- **预期结果**: 请求正常处理
- **优先级**: P1

### TC-HDL-005: Bearer Token 认证失败

- **前置条件**: 配置了 `LLMROUTER_API_KEY`
- **步骤**: 发送请求携带错误 token 或无 Authorization 头
- **预期结果**: 返回 `401 Unauthorized`
- **优先级**: P1

### TC-HDL-006: OPTIONS CORS 预检

- **步骤**: 发送 OPTIONS 请求
- **预期结果**: 返回 `204 No Content`，包含完整 CORS 头
- **优先级**: P1

### TC-HDL-007: 健康检查

- **步骤**: 发送 GET /health 请求
- **预期结果**: 返回 `{name, version, description}` JSON
- **优先级**: P2

---

## 4. 数据模型测试 (004-model-module)

### TC-MDL-001: Config Zod Schema 验证 - 有效配置

- **步骤**: 使用包含所有必需字段的有效配置
- **预期结果**: Zod 验证通过，类型正确推断
- **优先级**: P1

### TC-MDL-002: Config Zod Schema 验证 - 缺少必填字段

- **步骤**: 使用缺少 `backends` 的配置
- **预期结果**: Zod 验证失败，输出详细错误信息
- **优先级**: P1

### TC-MDL-003: BackendConfig 默认值填充

- **步骤**: 使用仅包含 `name`, `base_url`, `prefix` 的最简配置
- **预期结果**: `default`, `require_api_key`, `role_rewrites`, `unsupported_params` 使用默认值
- **优先级**: P1

### TC-MDL-004: JSON 与 YAML 配置一致性

- **步骤**: 分别加载等效的 JSON 和 YAML 配置
- **预期结果**: 解析后的配置对象完全一致
- **优先级**: P1

---

## 5. 日志模块测试 (005-logging-module)

### TC-LOG-001: 结构化 JSON 日志输出

- **步骤**: 触发一个请求
- **预期结果**: 日志输出为结构化 JSON 格式，包含 method, path, statusCode, duration 字段
- **优先级**: P2

### TC-LOG-002: 日志级别控制

- **步骤**: 设置 `LOG_LEVEL=error`
- **预期结果**: 仅 error 级别日志输出，debug/info/warn 被过滤
- **优先级**: P2

### TC-LOG-003: Authorization 头脱敏

- **步骤**: 发送带 Authorization 头的请求
- **预期结果**: 日志中 Authorization 头显示为 `Bearer rsk_1234...5678`（仅前10+后4字符）
- **优先级**: P1

---

## 6. 工具模块测试 (006-utils-module)

### TC-UTL-001: API 密钥生成

- **步骤**: 调用 `generateStrongAPIKey()`
- **预期结果**: 密钥格式为 `rsk_` + 48字符，仅包含大小写字母和数字
- **优先级**: P1

### TC-UTL-002: API 密钥唯一性

- **步骤**: 连续调用 `generateStrongAPIKey()` 10 次
- **预期结果**: 所有密钥均不相同
- **优先级**: P2

### TC-UTL-003: Authorization 头脱敏

- **步骤**: 调用 `redactAuthorization("Bearer sk-1234567890abcdef")`
- **预期结果**: 返回 `Bearer sk-1234567...cdef`（前10+后4字符）
- **优先级**: P1

---

## 7. 集成测试

### TC-INT-001: 完整请求流程

- **前置条件**: 配置了多个后端（含别名、角色重写、参数过滤）
- **步骤**: 发送 `model: "deepseek-v4-pro"` 请求
- **预期结果**:
  1. 别名展开为 `deepseek/deepseek-v4-pro`
  2. 前缀匹配 deepseek 后端
  3. 模型名变为 `deepseek-v4-pro`
  4. 角色重写应用
  5. 不支持参数移除
  6. 请求成功转发到后端
- **优先级**: P1

### TC-INT-002: 流式请求完整流程

- **前置条件**: 后端支持 SSE
- **步骤**: 发送 `stream: true` 请求
- **预期结果**: 流式响应逐 chunk 转发，Content-Type 为 `text/event-stream`
- **优先级**: P1

### TC-INT-003: 多后端并发路由

- **步骤**: 同时发送指向不同后端的请求
- **预期结果**: 每个请求正确路由到对应后端
- **优先级**: P2