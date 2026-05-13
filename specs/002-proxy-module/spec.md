# 代理模块 (002) 功能规格

> 模块路径: `src/proxy/`
> 生成时间: 2026-05-11

## 概述

代理模块负责创建和管理 HTTP 反向代理实例，实现请求改写（Director）、后端认证头注入、流式响应转发和调试日志记录。

## 功能需求

### FR-PRX-001: 多后端代理初始化

- 根据配置中的 `backends` 数组，为每个后端创建独立的代理实例
- 使用后端的 `prefix` 作为代理映射的键
- 支持配置一个默认代理实例（`default: true` 的后端）

### FR-PRX-002: 请求改写 (Director)

- 修改请求目标：Host、Scheme、URL Path 改写为后端地址
- 拼接路径：后端 `base_url` + 原始路径
- 设置代理头：`X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto`
- 处理后端认证：根据 `require_api_key` 和 `api_key` 注入或移除 Authorization 头

### FR-PRX-003: 后端认证头注入

- 当后端 `require_api_key` 为 `true` 时，注入 `Authorization: Bearer <key>`
- API 密钥来源：`api_key` 字段支持直接值或 `${env:VAR_NAME}` 语法
- 特殊回退：OpenAI 后端在 `api_key` 为空时回退使用 `OPENAI_API_KEY`
- 当后端 `require_api_key` 为 `false` 时，移除请求中的 Authorization 头

### FR-PRX-004: 代理错误处理

- 后端不可达时返回 `502 Bad Gateway`
- 记录代理错误日志（方法、URL、错误信息）
- 响应体包含 JSON 格式错误信息

### FR-PRX-005: 流式响应透传

- 检测 `Content-Type: text/event-stream` 的响应
- 流式响应不缓冲，逐 chunk 转发
- http-proxy-middleware 配置 `selfHandleResponse: false`

### FR-PRX-006: 调试日志

- debug 级别记录完整的请求/响应详情
- Authorization 头脱敏（前 10 + 后 4 字符）

## 关键函数

### `initializeProxies(config: Config): ProxyInstances`

根据配置初始化所有代理实例，返回 proxyMap 和 defaultProxy。

### `createDirector(backend: BackendConfig): ProxyRequestCallback`

创建请求改写函数：设置请求目标 URL、注入/移除认证头、设置代理头。

## 与 Go 版本对照

| Go 版本 | TypeScript 版本 | 说明 |
|---------|----------------|------|
| `httputil.ReverseProxy` | `http-proxy-middleware` | 代理库 |
| `makeDirector()` | `createDirector()` | 请求改写 |
| `debugTransport` | onProxyReq/onProxyRes 事件 | 调试日志 |
| `Proxies map[string]*ReverseProxy` | `proxyMap: Map<string, RequestHandler>` | 代理映射 |