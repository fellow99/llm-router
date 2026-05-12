# 请求处理模块 (003) 功能规格

> 模块路径: `src/middleware/` + `src/handler/` + `src/routes/`
> 生成时间: 2026-05-11

## 概述

请求处理模块是 LLM-Router 的核心业务逻辑层，负责 HTTP 请求的认证、CORS 处理、模型别名、角色重写、参数过滤和路由分发。通过 Express 中间件链实现横切关注点的分离。

## 功能需求

### FR-HDL-001: Bearer Token 认证中间件

- 验证所有非 OPTIONS 请求的 `Authorization: Bearer <key>` 头
- OPTIONS 请求跳过认证
- 无效或缺失认证返回 `401 Unauthorized`

### FR-HDL-002: CORS 中间件

- 处理 OPTIONS 预检请求，返回 `204 No Content`
- 设置完整 CORS 响应头（Allow-Origin, Allow-Methods, Allow-Headers, Allow-Credentials, Max-Age）

### FR-HDL-003: 模型别名处理

- 在路由处理之前应用模型别名映射
- 别名来自配置文件 `aliases` 字段
- 别名展开后继续进行前缀路由

### FR-HDL-004: 前缀路由

- 根据模型名称前缀匹配后端
- 匹配成功后从模型名中移除前缀
- 无匹配时使用默认后端代理
- 无默认后端时返回 `502 Bad Gateway`

### FR-HDL-005: 角色重写

- 在匹配到后端后，根据 `role_rewrites` 配置重写消息角色
- 仅重写映射中存在的角色，不匹配的保持不变

### FR-HDL-006: 不支持参数过滤

- 在匹配到后端后，根据 `unsupported_params` 配置移除请求参数
- 仅移除配置中明确列出的参数

### FR-HDL-007: 流式检测

- 检测请求体中的 `"stream": true` 参数
- 流式请求确保代理配置允许 SSE 直通

### FR-HDL-008: 健康检查

- GET /health 返回 `{ name, version, description }` JSON
- 不需要认证

## 关键函数

### `authMiddleware(config: Config): RequestHandler`
### `corsMiddleware(): RequestHandler`
### `preprocessRequest(config: Config): RequestHandler`
### `chatCompletionsHandler(proxies: ProxyInstances): RequestHandler`

## Express 中间件链注册顺序

```typescript
app.use(corsMiddleware);           // CORS 预检
app.use(authMiddleware);            // Bearer Token 认证
app.use(express.json());            // JSON 解析
app.post('/chat/completions', chatCompletionsHandler);
app.get('/health', healthCheckHandler);
app.all('*', defaultProxyHandler);
```

## 与 Go 版本对照

| Go 版本 | TypeScript 版本 | 说明 |
|---------|----------------|------|
| `handler.HandleRequest()` 单函数 | Express 中间件链 | 横切关注点分离 |
| 内嵌认证逻辑 | `authMiddleware()` | 独立中间件 |
| 内嵌 CORS | `corsMiddleware()` | 独立中间件 |
| 内嵌预处理 | `preprocessRequest()` | 独立中间件 |
| `http.ServeMux` | Express Router | 路由注册 |