# 002 代理模块 — 开发任务

> 依赖: 001-config（配置对象）, 004-model（类型定义）, 005-logging（日志器）
> 源码路径: `src/proxy/index.ts`, `src/proxy/director.ts`

## Phase 1: 代理初始化

- [ ] T002-01: 安装 http-proxy-middleware 依赖
  - 输出: `npm install http-proxy-middleware` + `npm install -D @types/http-proxy-middleware`（如需）
  - 验收: `package.json` 包含 http-proxy-middleware

- [ ] T002-02: 实现 `initializeProxies(config: RuntimeConfig): ProxyMap`
  - 输入: 002-proxy-module/spec.md FR-PRX-001
  - 输出: 遍历 config.backends，为每个后端创建 http-proxy-middleware 实例，以 prefix 为键存入 Map；标记 defaultProxy
  - 验收: 返回 `{ proxyMap: Map<string, RequestHandler>, defaultProxy: RequestHandler | null }`；每个代理配置了正确的 target 和 changeOrigin
  - 文件: `src/proxy/index.ts`

- [ ] T002-03: 实现路径改写 (pathRewrite)
  - 输入: 002-proxy-module/spec.md FR-PRX-002
  - 输出: 为每个代理配置 pathRewrite 规则，移除模型前缀
  - 验收: 请求 `POST /chat/completions` 转发到后端时路径正确（base_url + /chat/completions）
  - 文件: `src/proxy/index.ts`

## Phase 2: Director 与认证

- [ ] T002-04: 实现 `createDirector(backend: BackendConfig): ProxyRequestCallback`
  - 输入: 002-proxy-module/spec.md FR-PRX-002/003, plan.md §4
  - 输出: onProxyReq 回调函数，处理：(1) 设置 X-Real-IP, X-Forwarded-* 代理头 (2) 注入或移除 Authorization 头
  - 验收: 请求转发时包含正确的代理头；认证头按决策树注入/移除
  - 文件: `src/proxy/director.ts`

- [ ] T002-05: 实现认证注入决策树
  - 输入: 002-proxy-module/plan.md §4 认证决策树
  - 输出: 在 createDirector 内实现完整认证逻辑：
    - require_api_key=true → 从 api_key 字段解析（支持直接值或 `${env:VAR_NAME}` 语法）
    - OpenAI 回退 → process.env.OPENAI_API_KEY
    - require_api_key=false → 移除 Authorization 头
  - 验收: 各种后端配置组合下认证头正确注入或移除
  - 文件: `src/proxy/director.ts`

## Phase 3: 错误处理与调试

- [ ] T002-06: 实现代理错误处理与调试日志
  - 输入: 002-proxy-module/spec.md FR-PRX-004/005/006
  - 输出: (1) onError 回调返回 502 Bad Gateway (2) onProxyRes 记录响应日志 (3) selfHandleResponse: false 确保流式直通
  - 验收: 后端不可达返回 502；流式响应 Content-Type 为 text/event-stream；debug 级别记录请求/响应详情
  - 文件: `src/proxy/index.ts`