# LLM-Router 整体规格文档

> 生成时间: 2026-05-11 | 基于 Go 参考项目规格适配 TypeScript/Express 实现
> 版本: 0.1.0 (TypeScript/Express 重实现)

## 1. 概述

**LLM-Router** 是一个基于 TypeScript/Express 的反向代理服务器，用于将 OpenAI 兼容的 `chat/completions` API 请求根据模型前缀路由到不同的 LLM 后端（OpenAI、Groq、Ollama、DeepSeek 等）。它解决了 Cursor 等 IDE 无法同时配置多个 LLM 提供商的限制。

本项目是 Go 版本 llm-router 的 TypeScript 重写，保持功能对等，利用 Node.js/Express 生态提供更灵活的部署方式。

## 2. 功能需求

### FR-01: 多后端路由

- 系统必须支持根据模型名称前缀将请求路由到不同后端
- 前缀格式为 `<provider>/`（如 `openai/`, `ollama/`, `groq/`）
- 路由时必须从模型名中移除前缀再转发给后端
- 必须支持配置一个默认后端（`default: true`），处理无前缀匹配的请求

**实现**: `src/handler/chatHandler.ts`, `src/proxy/index.ts`

### FR-02: 模型别名

- 系统必须支持模型别名映射（如 `o1` → `groq/deepseek-r1-distill-qwen-32b`）
- 别名必须在路由处理之前应用
- 别名配置通过配置文件 (`config.json` / `config.yaml`) 的 `aliases` 字段定义

**实现**: `src/middleware/request-preprocessor.ts`

### FR-03: 角色重写

- 系统必须支持按后端配置消息角色映射（如 `developer` → `system`）
- 角色重写仅在匹配到后端后应用
- 不匹配的原始角色保持不变

**实现**: `src/middleware/request-preprocessor.ts`

### FR-04: 不支持参数过滤

- 系统必须支持按后端配置移除不支持的请求参数（如 `reasoning_effort`）
- 参数移除仅在匹配到后端后应用
- 仅移除配置中明确列出的参数

**实现**: `src/middleware/request-preprocessor.ts`

### FR-05: 客户端认证

- 系统必须验证所有非 OPTIONS 请求的 Bearer Token 认证
- 认证使用 `LLMROUTER_API_KEY` 作为期望值
- 无效或缺失认证返回 `401 Unauthorized`

**实现**: `src/middleware/auth.ts`

### FR-06: 后端认证代理

- 系统必须为代表需要 API 密钥的后端自动注入认证头
- API 密钥通过 `api_key` 字段注入（支持直接值或 `${env:VAR_NAME}` 语法）
- OpenAI 后端在 `api_key` 为空时回退使用 `OPENAI_API_KEY`
- 不需要认证的后端必须移除请求中的 Authorization 头

**实现**: `src/proxy/director.ts`

### FR-07: 自动 API 密钥生成

- 系统必须在未配置 API 密钥时自动生成密码学安全的随机密钥
- 密钥格式: `rsk_` + 48 个随机字符（大小写字母 + 数字）
- 使用自动生成密钥时必须在启动时打印到控制台

**实现**: `src/utils/keygen.ts`, `src/config/index.ts`

### FR-08: CORS 支持

- 系统必须处理 OPTIONS 预检请求，返回 `204 No Content`
- 必须设置完整的 CORS 响应头
- 支持 `Access-Control-Allow-Credentials: true`

**实现**: `src/middleware/cors.ts`

### FR-09: 流式响应支持

- 系统必须正确检测流式请求（`"stream":true`）
- 流式响应必须通过 SSE（Server-Sent Events）格式转发
- 流式响应的 Content-Type 必须为 `text/event-stream`

**实现**: `src/handler/chatHandler.ts`, `src/proxy/index.ts`

### FR-10: 配置管理

- 支持从 JSON（含 JSONC 注释）和 YAML 格式加载配置
- 支持从 `.env` 文件加载环境变量
- 支持命令行参数覆盖
- 配置优先级: 命令行 > 环境变量 > .env 文件 > 配置文件 > 默认值
- 所有配置必须通过 Zod Schema 验证

**实现**: `src/config/index.ts`, `src/config/schema.ts`

### FR-11: 结构化日志

- 使用 Winston 结构化日志器
- 支持可配置日志级别（debug/info/warn/error）
- debug 级别记录完整的请求/响应详情
- Authorization 头在日志中脱敏显示（前 10 + 后 4 字符）

**实现**: `src/logger/index.ts`, `src/utils/redact.ts`

### FR-12: 响应录制

- 系统必须录制完整的 HTTP 响应以支持日志记录
- 流式响应限制最大录制大小为 1MB
- SSE 流式内容尝试重新组装为可读格式

**实现**: `src/utils/stream.ts`

### FR-13: 类型安全配置

- 所有配置结构必须使用 Zod Schema 定义
- Zod Schema 同时提供运行时验证和 TypeScript 类型推断
- 配置加载后必须通过 Zod 验证才能使用
- 验证失败时必须输出详细的错误信息并退出进程

**实现**: `src/config/schema.ts`, `src/types/index.ts`

## 3. 非功能需求

### NFR-01: 性能

- Express 服务器应能处理并发请求
- http-proxy-middleware 连接池配置应合理
- 流式响应不应阻塞事件循环

### NFR-02: 可靠性

- 配置文件解析错误必须优雅退出并提供清晰错误信息
- 后端不可达时返回 `502 Bad Gateway`
- 全局错误处理中间件捕获未处理异常

### NFR-03: 可观测性

- 所有请求必须记录方法、路径、状态码、延迟
- 错误请求必须记录详细错误信息
- 日志格式应为结构化 JSON

### NFR-04: 安全性

- API 密钥不硬编码在源码中
- 日志中的敏感信息必须脱敏
- 所有非 OPTIONS 请求要求 Bearer Token 认证
- Zod Schema 验证所有配置输入

### NFR-05: 兼容性

- 必须兼容 OpenAI Chat Completions API 协议
- 支持流式 (SSE) 和非流式响应
- 支持 Cursor 等 IDE 的 API 调用模式

### NFR-06: 类型安全

- TypeScript 严格模式（`strict: true`）必须在所有源码文件中启用
- 禁止使用 `any`、`@ts-ignore`、`@ts-expect-error`
- 所有配置使用 Zod Schema 运行时验证