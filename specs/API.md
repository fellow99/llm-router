# LLM-Router API 清单

> 生成时间: 2026-05-11 | 基于 Go 参考项目规格适配 TypeScript/Express 实现

## 对外 API 端点

### HTTP 端点

| 方法 | 路径 | 用途 | 认证 | 入口文件 |
|------|------|------|------|---------|
| POST | `/chat/completions` | 核心 Chat Completions API，路由到后端 | Bearer Token | `src/routes/chat.ts` |
| GET | `/health` | 健康检查，返回服务名称与版本 | 无需认证 | `src/routes/index.ts` |
| OPTIONS | `/` (任意路径) | CORS 预检请求 | 无需认证 | `src/middleware/cors.ts` |
| * | `/` (其他路径) | 通用代理转发到默认后端 | Bearer Token | `src/proxy/index.ts` |

### 认证机制

| 机制 | 说明 | 实现位置 |
|------|------|---------|
| Bearer Token 认证 | 请求头 `Authorization: Bearer <LLMROUTER_API_KEY>` | `src/middleware/auth.ts` |
| API 密钥来源 | 命令行参数 > 环境变量 > .env 文件 > 自动生成 | `src/config/index.ts` |
| 后端认证 | 各后端独立 API Key，通过 `key_env_var` 配置 | `src/proxy/director.ts` |

### CORS 配置

| 头部 | 值 | 说明 |
|------|-----|------|
| `Access-Control-Allow-Origin` | 请求来源或 `*` | 允许跨域请求 |
| `Access-Control-Allow-Methods` | `GET, POST, OPTIONS, PUT, DELETE` | 允许的 HTTP 方法 |
| `Access-Control-Allow-Headers` | 请求头或默认 `Authorization, Content-Type, Accept` | 允许的请求头 |
| `Access-Control-Allow-Credentials` | `true` | 允许发送凭据 |
| `Access-Control-Max-Age` | `86400` (24小时) | 预检缓存时间 |

### Chat Completions 特殊处理

| 功能 | 说明 | 实现位置 |
|------|------|---------|
| 模型前缀路由 | `openai/gpt-4o-mini` → OpenAI 后端，模型名变为 `gpt-4o-mini` | `src/handler/chatHandler.ts` |
| 模型别名 | `o1` → `groq/deepseek-r1-distill-qwen-32b` | `src/middleware/request-preprocessor.ts` |
| 角色重写 | `developer` → `system` 等角色映射 | `src/middleware/request-preprocessor.ts` |
| 参数过滤 | 移除后端不支持的参数（如 `reasoning_effort`） | `src/middleware/request-preprocessor.ts` |
| 流式检测 | 检测 `"stream":true` 参数确保 SSE 流式传输 | `src/handler/chatHandler.ts` |
| 默认后端路由 | 无前缀匹配时路由到 `default: true` 的后端 | `src/handler/chatHandler.ts` |
| 无匹配处理 | 无默认后端时返回 `502 Bad Gateway` | `src/handler/chatHandler.ts` |

### 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--config` | `config.json` | 配置文件路径（支持 JSON/YAML） |
| `--llmrouter-api-key-env` | `LLMROUTER_API_KEY` | API 密钥环境变量名 |
| `--llmrouter-api-key` | (空) | 直接指定 API 密钥 |
| `--port` | `0` (使用配置文件值) | 监听端口 |
| `--log-level` | `warn` | 日志级别 |

### 配置文件 API (`config.json` / `config.yaml`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `listening_port` | number | 服务监听端口（默认 11411） |
| `llmrouter_api_key_env` | string | LLM-Router API 密钥的环境变量名 |
| `aliases` | Record\<string, string\> | 模型别名映射 |
| `backends` | BackendConfig[] | 后端配置数组 |
| `backends[].name` | string | 后端名称 |
| `backends[].base_url` | string | 后端 API 基础 URL |
| `backends[].prefix` | string | 模型前缀（如 `openai/`） |
| `backends[].default` | boolean | 是否为默认后端 |
| `backends[].require_api_key` | boolean | 是否需要 API 密钥 |
| `backends[].key_env_var` | string | API 密钥环境变量名或直接密钥值 |
| `backends[].role_rewrites` | Record\<string, string\> | 角色重写映射 |
| `backends[].unsupported_params` | string[] | 需要移除的参数名列表 |

### 健康检查响应

```json
{
  "name": "llm-router",
  "version": "0.1.0",
  "description": "LLM API Router - Route OpenAI-compatible requests to multiple backends"
}
```