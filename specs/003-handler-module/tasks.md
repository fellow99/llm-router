# 003 请求处理模块 — 开发任务

> 依赖: 001-config（配置对象）, 002-proxy（代理实例）, 004-model（类型定义）, 005-logging（日志器）, 006-utils（工具函数）
> 源码路径: `src/middleware/`, `src/handler/`, `src/routes/`

## Phase 1: 基础中间件

- [ ] T003-01: 实现认证中间件 `src/middleware/auth.ts`
  - 输入: 003-handler-module/spec.md FR-HDL-001
  - 输出: `authMiddleware(config: RuntimeConfig): RequestHandler`，验证 Bearer Token，OPTIONS 跳过
  - 验收: 无/错误 Token 返回 401；正确 Token 调用 next()；OPTIONS 请求跳过
  - 文件: `src/middleware/auth.ts`

- [ ] T003-02: 实现 CORS 中间件 `src/middleware/cors.ts`
  - 输入: 003-handler-module/spec.md FR-HDL-002
  - 输出: `corsMiddleware(): RequestHandler`，处理 OPTIONS 预检返回 204，设置完整 CORS 头
  - 验收: OPTIONS 请求返回 204 + CORS 头；其他请求设置 CORS 头后继续
  - 文件: `src/middleware/cors.ts`

## Phase 2: 请求预处理

- [ ] T003-03: 实现模型别名展开 `applyAlias(model, aliases): string`
  - 输入: 003-handler-module/spec.md FR-HDL-003
  - 输出: 函数接收模型名和别名映射，返回展开后的模型名；别名必须在路由前应用
  - 验收: `"o1"` + aliases `{"o1":"groq/deepseek-r1"}` → `"groq/deepseek-r1"`；无别名时原样返回
  - 文件: `src/middleware/request-preprocessor.ts`

- [ ] T003-04: 实现角色重写 `applyRoleRewrites(messages, roleRewrites): ChatMessage[]`
  - 输入: 003-handler-module/spec.md FR-HDL-003
  - 输出: 函数遍历 messages，将匹配 roleRewrites 的 role 替换为新值
  - 验收: `role:"developer"` + `{"developer":"system"}` → `role:"system"`；未匹配角色保持不变
  - 文件: `src/middleware/request-preprocessor.ts`

- [ ] T003-05: 实现参数过滤 `filterUnsupportedParams(body, unsupportedParams): ChatCompletionRequest`
  - 输入: 003-handler-module/spec.md FR-HDL-003
  - 输出: 函数从请求体中删除 unsupportedParams 列出的字段
  - 验收: `{model, messages, reasoning_effort}` + `["reasoning_effort"]` → `{model, messages}`
  - 文件: `src/middleware/request-preprocessor.ts`

## Phase 3: 路由处理

- [ ] T003-06: 实现前缀路由匹配 `matchBackend(model, config): MatchResult | null`
  - 输入: 003-handler-module/plan.md §6
  - 输出: 函数遍历后端配置匹配模型前缀，返回匹配的代理和后端信息；无匹配时尝试默认后端
  - 验收: `"openai/gpt-4o"` → `{proxy, backend: openai, targetModel: "gpt-4o"}`；无匹配返回 null
  - 文件: `src/handler/chatHandler.ts`

- [ ] T003-07: 实现 Chat Completions 处理器 `chatCompletionsHandler`
  - 输入: 003-handler-module/spec.md FR-HDL-004/007
  - 输出: Express RequestHandler，整合：(1) 读取请求体 (2) 检测流式标记 (3) 应用别名 (4) 匹配后端 (5) 移除前缀 (6) 角色重写 (7) 参数过滤 (8) 代理转发
  - 验收: 完整请求处理链可端到端执行；流式请求直通；502 当无匹配后端
  - 文件: `src/handler/chatHandler.ts`

## Phase 4: 路由注册

- [ ] T003-08: 实现路由注册与健康检查
  - 输入: 003-handler-module/spec.md FR-HDL-005/006
  - 输出: (1) `GET /health` 返回 `{name, version, description}` (2) `POST /chat/completions` 路由 (3) 通配符路由转发到 defaultProxy
  - 验收: /health 返回正确 JSON；其他路径代理到默认后端；无默认后端返回 502
  - 文件: `src/routes/index.ts`, `src/routes/chat.ts`