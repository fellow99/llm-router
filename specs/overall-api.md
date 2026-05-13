# LLM-Router 对外接口模型

> 生成时间: 2026-05-11 | 基于 Go 参考项目规格适配 TypeScript/Express 实现

## 1. HTTP API 端点

### 1.1 POST /chat/completions

核心端点，接收 OpenAI 兼容的 Chat Completion 请求并路由到对应后端。

**请求**:

```
POST /chat/completions HTTP/1.1
Host: <llm-router-host>:11411
Authorization: Bearer <LLMROUTER_API_KEY>
Content-Type: application/json

{
  "model": "<prefix>/<model-name>",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello"}
  ],
  "stream": true,
  "temperature": 0.7
}
```

**模型前缀路由规则**:

| 请求模型 | 匹配后端 | 转发模型名 | 说明 |
|---------|---------|-----------|------|
| `openai/gpt-4o-mini` | openai | `gpt-4o-mini` | 前缀 `openai/` |
| `deepseek/deepseek-v4` | deepseek | `deepseek-v4` | 前缀 `deepseek/` |
| `baidu/glm5.1` | baidu | `glm5.1` | 前缀 `baidu/` |
| `gpt-4o-mini` | (默认) | `gpt-4o-mini` | 无前缀 → 默认后端 |

**模型别名处理** (在路由之前):

| 别名 | 映射目标 | 说明 |
|-----|---------|------|
| `o1` | `groq/deepseek-r1-distill-qwen-32b` | 别名在路由前展开 |
| `deepseek-v4-pro` | `deepseek/deepseek-v4-pro` | 展开后再进行前缀路由 |

**响应**: 透传后端的 HTTP 响应（包括流式 SSE）

**认证失败**: `401 Unauthorized`

**无匹配后端**: `502 Bad Gateway`

---

### 1.2 GET /health

健康检查端点，返回服务状态信息。

**请求**:

```
GET /health HTTP/1.1
Host: <llm-router-host>:11411
```

**响应**:

```json
{
  "name": "llm-router",
  "version": "0.1.0",
  "description": "LLM API Router - Route OpenAI-compatible requests to multiple backends"
}
```

---

### 1.3 OPTIONS / (CORS 预检)

```
OPTIONS /any-path HTTP/1.1
Origin: https://cursor.sh
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization, Content-Type
```

**响应**:

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://cursor.sh
Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type, Accept
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
Content-Type: text/plain
Content-Length: 0
Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers
```

---

### 1.4 其他路径 (通用代理转发)

所有非 `/chat/completions`、非 OPTIONS、非 `/health` 的请求直接转发到默认后端。

```
GET|POST|PUT|DELETE /any/path HTTP/1.1
Authorization: Bearer <LLMROUTER_API_KEY>
```

- 需要认证
- 不经过模型别名、角色重写、参数过滤处理
- 直接由默认后端代理转发
- 无默认后端时返回 `502 Bad Gateway`

---

## 2. 认证接口

### 2.1 客户端认证

| 字段 | 说明 |
|------|------|
| 认证方式 | Bearer Token |
| 请求头 | `Authorization: Bearer <LLMROUTER_API_KEY>` |
| 密钥来源优先级 | 命令行参数 → 环境变量 → .env 文件 → 自动生成 |

### 2.2 后端认证

| 配置字段 | 说明 |
|---------|------|
| `require_api_key` | 后端是否需要认证 |
| `api_key` | API 密钥值或 `${env:VAR_NAME}` 环境变量引用 |
| 特殊回退 | OpenAI 后端在 `api_key` 为空时回退使用 `OPENAI_API_KEY` |

**认证流程**:

```
后端认证流程 (Director):
  │
  ├── require_api_key = true?
  │     ├── api_key 有值?
  │     │     ├── 是 `${env:VAR_NAME}` 语法?
  │     │     │     └── process.env[VAR_NAME] → 设置 Authorization
  │     │     └── 是直接密钥值?
  │     │           └── 直接设置 Authorization: Bearer <key>
  │     ├── api_key 为空且名称含 "openai"?
  │     │     └── 回退 process.env.OPENAI_API_KEY → 设置 Authorization
  │     └── 无法获取密钥? → 不设置认证头
  │
  └── require_api_key = false?
        └── 移除请求中的 Authorization 头
```

---

## 3. 配置文件格式

支持 JSON（含 JSONC 注释）和 YAML 两种格式。配置通过 Zod Schema 验证确保类型安全。

### 3.1 示例配置 (`config.json`)

```json
{
  "listening_port": 11411,
  "llmrouter_api_key": "",
  "aliases": {
    "o1": "groq/deepseek-r1-distill-qwen-32b",
    "deepseek-v4-pro": "deepseek/deepseek-v4-pro"
  },
  "backends": [
    {
      "name": "openai",
      "base_url": "https://api.openai.com/v1",
      "prefix": "openai/",
      "default": true,
      "require_api_key": true,
      "api_key": "${env:OPENAI_API_KEY}"
    },
    {
      "name": "deepseek",
      "base_url": "https://api.deepseek.com",
      "prefix": "deepseek/",
      "require_api_key": true,
      "api_key": "${env:DEEPSEEK_API_KEY}",
      "role_rewrites": { "developer": "system" },
      "unsupported_params": ["reasoning_effort"]
    }
  ]
}
```

### 3.2 Zod Schema 验证

配置加载后通过 Zod Schema 验证。验证规则：

| 字段 | 验证 |
|------|------|
| `backends[].name` | 非空字符串 |
| `backends[].base_url` | 合法 URL |
| `backends[].prefix` | 非空字符串 |
| `backends` | 至少一个后端 |
| `listening_port` | 正整数 |
| 默认后端 | 最多一个 `default: true` (软验证) |

---

## 4. 错误响应格式

与 OpenAI API 错误格式保持兼容：

```json
{
  "error": {
    "message": "Unauthorized",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

| HTTP 状态码 | 类型 | code | 说明 |
|------------|------|------|------|
| 401 | `authentication_error` | `invalid_api_key` | 缺少或无效 Bearer Token |
| 400 | `invalid_request_error` | `invalid_body` | 请求体解析失败 |
| 502 | `server_error` | `no_backend` | 无匹配后端且无默认后端 |
| 502 | `server_error` | `backend_unreachable` | 后端不可达 |

---

## 5. 流式响应协议

### 5.1 SSE 格式

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### 5.2 流式响应要求

- Content-Type: `text/event-stream`
- 逐 chunk 转发，不缓冲完整响应
- 保持 `data: [DONE]` 终止标记
- http-proxy-middleware 配置 `selfHandleResponse: false` 以直通流式