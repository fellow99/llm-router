# LLM-Router 整体技术方案

> 生成时间: 2026-05-11 | 基于 Go 参考项目规格适配 TypeScript/Express 实现

## 1. 技术栈

| 层级 | 技术选型 | 理由 |
|------|---------|------|
| 语言 | TypeScript 5.7+ (strict mode) | 类型安全、生态丰富、与 Express 集成良好 |
| 运行时 | Node.js 20+ | LTS 版本、稳定支持 |
| HTTP 框架 | Express 4.21+ | Node.js 生态最成熟的 Web 框架，中间件模型清晰 |
| 反向代理 | http-proxy-middleware 3.x | Express 生态最成熟的代理库，支持 SSE |
| 配置校验 | Zod 3.24+ | 运行时 Schema 校验 + TypeScript 类型推断 |
| 日志 | Pino / Winston | 结构化 JSON 日志，高性能 |
| 环境变量 | dotenv 16.4+ | Node.js 标准 .env 加载库 |
| YAML 解析 | yaml 2.7+ | YAML 配置文件支持 |
| JSONC 解析 | jsonc-parser 3.3+ | 带注释的 JSON 配置文件支持 |
| 构建 | esbuild | 极速 TypeScript 打包 |
| 开发 | ts-node + nodemon | 开发时热重载 |

## 2. 架构方案

### 2.1 请求流程

```
Client → LLM-Router (Express :11411)
  │
  ├── CORS 中间件 → OPTIONS 请求返回 204
  ├── 认证中间件 → Bearer Token 验证 (401 if invalid)
  ├── JSON Parser → 解析请求体
  ├── 路由分发:
  │     ├── POST /chat/completions → chatHandler
  │     │     ├── 读取请求体
  │     │     ├── 应用模型别名 (aliases)
  │     │     ├── 匹配后端前缀 → proxy
  │     │     ├── 移除前缀 (openai/gpt-4o → gpt-4o)
  │     │     ├── 应用角色重写 (role_rewrites)
  │     │     ├── 移除不支持参数 (unsupported_params)
  │     │     └── proxy → 后端 API
  │     ├── GET /health → healthCheck
  │     └── * /other → DefaultProxy → 默认后端
  │                    └── 无默认后端 → 502
```

### 2.2 核心组件

| 组件 | 模块 | 职责 | 关键导出 |
|------|------|------|---------|
| 入口 | `src/app.ts` | 初始化配置、代理、启动 Express 服务 | `createApp()`, `startServer()` |
| 配置 | `src/config/` | JSON/YAML 配置加载、Zod 校验、环境变量 | `loadConfig()`, `configSchema` |
| 类型 | `src/types/` | Zod Schema 定义、TypeScript 类型推断 | `Config`, `BackendConfig`, `configSchema` |
| 认证中间件 | `src/middleware/auth.ts` | Bearer Token 认证 | `authMiddleware()` |
| CORS 中间件 | `src/middleware/cors.ts` | CORS 预检处理 | `corsMiddleware()` |
| 请求预处理 | `src/middleware/request-preprocessor.ts` | 模型别名、角色重写、参数过滤 | `preprocessRequest()` |
| 路由 | `src/routes/` | Express 路由定义与健康检查 | `chatRouter`, `healthRouter` |
| 处理 | `src/handler/` | Chat Completions 请求处理 | `chatCompletionsHandler()` |
| 代理 | `src/proxy/` | 反向代理创建与请求转发 | `initializeProxies()`, `proxyMap`, `defaultProxy` |
| 代理改写 | `src/proxy/director.ts` | 请求改写（URL、认证头） | `createDirector()` |
| 日志 | `src/logger/` | Winston/Pino 日志器工厂 | `createLogger()` |
| 工具 | `src/utils/` | 密钥脱敏、密钥生成、流式处理 | `redactAuthorization()`, `generateStrongAPIKey()` |

### 2.3 配置加载流程

```
1. 解析命令行参数 (--config, --port, --llmrouter-api-key 等)
   ↓
2. 初始化日志器 (createLogger)
   ↓
3. 加载 .env 文件 (dotenv)
   ↓
4. 加载配置文件 (JSON/YAML → Zod 校验)
   ↓ 配置文件不存在？
   → 使用硬编码默认配置
   ↓ Zod 校验失败？
   → 输出详细错误信息并退出进程
   ↓
5. 应用命令行参数覆盖 (port, apiKeyEnv, apiKey)
   ↓
6. 确定 LLM_ROUTER_API_KEY (命令行 > 环境变量 > 自动生成)
   ↓
7. 初始化反向代理 (initializeProxies)
   ↓
8. 创建 Express 应用，注册中间件与路由
   ↓
9. 启动 HTTP 服务 (app.listen)
```

### 2.4 反向代理设计

```
http-proxy-middleware
  ├── router (请求路由)
  │     ├── 根据 prefix 匹配到目标后端
  │     └── 无匹配 → 默认后端
  │
  ├── pathRewrite (路径改写)
  │     └── 移除模型前缀 (如 openai/ → 移除前缀)
  │
  ├── onProxyReq (请求改写 - 类似 Director)
  │     ├── 设置后端认证头 (Authorization)
  │     ├── 移除不需要的认证头
  │     └── 设置代理头 (X-Real-IP, X-Forwarded-*)
  │
  ├── onProxyRes (响应处理)
  │     ├── 记录响应状态码
  │     └── 非流式响应：录制响应体用于日志
  │
  ├── errorHandler (错误处理)
  │     └── 记录错误 + 返回 502 Bad Gateway
  │
  └── 事件钩子
        ├── proxyReq (代理请求事件)
        ├── proxyRes (代理响应事件)
        └── error (错误事件)
```

### 2.5 与 Go 版本架构映射

| 概念 | Go 版本 | TypeScript 版本 |
|------|---------|---------------|
| HTTP 入口 | `cmd/main.go` | `src/app.ts` |
| 配置 | `config/config.go` + `flag` | `src/config/` + Zod + dotenv |
| 处理 | `handler/handler.go` ServeMux | Express middleware chain |
| 代理 | `httputil.ReverseProxy` | `http-proxy-middleware` |
| 类型 | `model/model.go` struct | `src/types/` Zod + TypeScript |
| 日志 | `logging/logging.go` Zap | `src/logger/` Winston |
| 工具 | `utils/utils.go` | `src/utils/` |
| 请求预处理 | handler 内联逻辑 | Express 中间件分离 |

## 3. 数据流设计

### 3.1 请求体转换流程

```
客户端请求 → 认证 → CORS → JSON 解析 → 路由判定

POST /chat/completions 处理链:
  1. 解析请求体
  2. 检测流式标记 (stream: true)
  3. 应用模型别名 (aliases 映射)
  4. 匹配后端前缀
  5. 移除模型名前缀
  6. 应用角色重写 (role_rewrites)
  7. 移除不支持参数 (unsupported_params)
  8. 构建代理请求
  9. 注入后端认证头
  10. 转发请求到后端
  11. 流式响应直通 / 非流式响应录制

其他路径:
  1. 认证检查
  2. 直接代理转发到默认后端
```

### 3.2 SSE 流式处理

```
后端 SSE 响应
  │
  ▼
http-proxy-middleware (selfHandleResponse: false)
  │
  ▼
Node.js Stream 直通
  │
  ├── Content-Type: text/event-stream
  ├── Transfer-Encoding: chunked
  └── 逐 chunk 转发到客户端
```

## 4. 依赖关系

### 4.1 运行时依赖

| 包 | 版本 | 用途 |
|----|------|------|
| express | ^4.21 | HTTP 框架 |
| http-proxy-middleware | ^3.x | 反向代理 |
| zod | ^3.24 | Schema 校验与类型推断 |
| dotenv | ^16.4 | 环境变量加载 |
| yaml | ^2.7 | YAML 配置解析 |
| jsonc-parser | ^3.3 | JSONC 配置解析 |
| pino / winston | TBD | 结构化日志 |

### 4.2 开发依赖

| 包 | 用途 |
|----|------|
| typescript | 类型检查与编译 |
| ts-node | 开发环境直接运行 TS |
| nodemon | 开发时热重载 |
| @types/express | Express 类型 |
| @types/node | Node.js 类型 |
| vitest | 单元测试（计划中） |
| esbuild | 生产构建 |

## 5. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| http-proxy-middleware SSE 支持不完整 | 流式响应中断 | 配置 `selfHandleResponse: false`，参考 Go 版本的流式处理模式 |
| Zod 配置校验过严 | 配置文件不灵活 | 使用 `.passthrough()` 允许未知字段，仅校验必需字段 |
| Express 4.x 性能限制 | 高并发下延迟 | Node.js 事件循环模型天然支持并发，必要时考虑 Fastify |
| 配置格式兼容性 | JSON/YAML 解析差异 | 统一使用 Zod Schema 校验，确保两种格式产生相同结果 |

## 6. 改进方向（相对 Go 版本）

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 配置 Hot-Reload | 监听配置文件变更，自动重载 | P2 |
| 请求限流 | Express rate-limit 中间件 | P2 |
| 健康检查增强 | 检查后端可用性 | P3 |
| Prometheus 指标 | 请求计数、延迟直方图 | P3 |
| Docker 镜像 | 多阶段构建，减小镜像大小 | P2 |
| 测试覆盖 | vitest 单元 + 集成测试 | P1 |