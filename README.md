# llm-router

大模型聚合路由服务 —— 南向聚合连接多个大模型 API，北向提供兼容 OpenAI 接口的统一服务端点。解决 Cursor 等 IDE 无法同时配置多个 LLM 提供商的限制。

参考工程：[kcolemangt/llm-router](https://github.com/kcolemangt/llm-router.git)

## 核心特性

- **多后端前缀路由** — 根据模型名前缀（`openai/`、`deepseek/` 等）自动路由到对应后端，支持配置一个默认后端处理无前缀请求
- **模型别名** — `o1` → `groq/deepseek-r1-distill-qwen-32b`，简化模型名称
- **路由权重** — 一个别名映射到多个后端，按权重随机选择 + 失败自动回退
- **消息角色重写** — 按后端自动转换不兼容角色（如 `developer` → `system`）
- **参数过滤** — 移除后端不支持的请求参数（如 `reasoning_effort`）
- **客户端认证** — Bearer Token 认证保护服务端点
- **后端认证代理** — 自动注入后端 API Key，前端无感知
- **自动 API 密钥生成** — 未配置 API Key 时自动生成 `rsk_` 前缀的强密码学密钥
- **CORS 支持** — 完整的跨域请求头 + OPTIONS 预检处理
- **SSE 流式响应** — 原生支持 `text/event-stream` 流式转发
- **结构化日志** — Winston JSON 日志，API Key 自动脱敏
- **多格式配置** — 支持 JSON（含 JSONC 注释）和 YAML 配置文件
- **双路径兼容** — 同时支持 `POST /v1/chat/completions` 和 `POST /chat/completions`，兼容 OpenAI SDK 和直接 API 调用

## 架构概览

```
┌────────────────────────────────────────────────────┐
│              客户端 (Cursor / ChatBox 等)            │
│  OpenAI Base URL → http://localhost:11411/          │
│  OpenAI API Key → LLM-Router API Key                │
└────────────────────────┬───────────────────────────┘
                         │  HTTPS
                         ▼
┌────────────────────────────────────────────────────┐
│              llm-router (Express, Port 11411)       │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │            Express 中间件链                    │   │
│  │  CORS → Auth (Bearer) → 请求预处理 → 路由      │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
│  ┌──────────────────▼──────────────────────────┐   │
│  │         请求处理 (handler/)                    │   │
│  │  别名映射 → 前缀匹配 → 角色重写 → 参数过滤     │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
│  ┌──────────────────▼──────────────────────────┐   │
│  │         反向代理层 (proxy/)                    │   │
│  │  Proxy Map (前缀→后端) + Director (请求改写)    │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
└─────────────────────┼───────────────────────────────┘
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ OpenAI  │  │ DeepSeek│  │  Baidu  │
   └─────────┘  └─────────┘  └─────────┘
```

## 路由流程

```
请求 POST /v1/chat/completions (或 /chat/completions)
      │
      ▼
  ┌─────────┐  无/无效   ┌──────────┐
  │ Auth认证 │──────────▶│ 401 响应  │
  └────┬─────┘           └──────────┘
       │ 有效
       ▼
  ┌─────────────┐
  │ 模型别名映射  │  o1 → openai/o1-mini
  └──────┬──────┘
         ▼
  ┌─────────────────┐  无匹配   ┌────────────┐
  │ 前缀匹配后端      │─────────▶│ 默认后端代理 │
  │ deepseek/chat →  │          └────────────┘
  │ DeepSeek          │
  └──────┬───────────┘
         │ 匹配成功
         ▼
  ┌─────────────┐
  │ 去除模型前缀  │  deepseek/chat → chat
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │ 角色重写     │  developer → system
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │ 参数过滤     │  移除 reasoning_effort 等
  └──────┬──────┘
         ▼
  ┌─────────────────┐
  │ 注入后端 API Key │
  │ 转发到目标后端    │
  └─────────────────┘
```

## 功能清单

| 功能 | 状态 | 实现位置 |
|------|------|---------|
| 多后端前缀路由 | ✅ | `src/handler/chatHandler.ts`, `src/proxy/index.ts` |
| 模型别名映射 | ✅ | `src/middleware/preprocessor.ts` |
| 路由权重与回退 | ✅ | `src/middleware/preprocessor.ts`, `src/handler/chatHandler.ts` |
| 消息角色重写 | ✅ | `src/middleware/preprocessor.ts` |
| 不支持参数过滤 | ✅ | `src/middleware/preprocessor.ts` |
| Bearer Token 认证 | ✅ | `src/middleware/auth.ts` |
| 后端认证代理注入 | ✅ | `src/proxy/director.ts` |
| 自动 API 密钥生成 | ✅ | `src/utils/keygen.ts`, `src/config/index.ts` |
| CORS 支持 | ✅ | `src/middleware/cors.ts` |
| SSE 流式响应 | ✅ | `src/proxy/index.ts` |
| 结构化日志 | ✅ | `src/logger/index.ts` |
| 多格式配置加载 | ✅ | `src/config/index.ts` |
| Zod 配置校验 | ✅ | `src/types/index.ts` |
| 日志脱敏 | ✅ | `src/utils/redact.ts` |
| 健康检查 | ✅ | `src/routes/index.ts` |

## 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 语言 | TypeScript 5.7+ | 类型安全 |
| 运行时 | Node.js 18+ | - |
| HTTP 框架 | Express 4.21 | 路由与中间件 |
| 反向代理 | http-proxy-middleware 4.x | HTTP 请求转发 |
| 配置校验 | Zod 3.24+ | 运行时 Schema 校验 |
| 日志框架 | Winston 3.x | 结构化 JSON 日志 |
| 环境变量 | dotenv 16.4 | .env 文件加载 |
| YAML 解析 | yaml 2.7 | YAML 配置文件 |
| JSONC 解析 | jsonc-parser 3.3 | 带注释 JSON 配置文件 |
| CLI 解析 | commander 13.x | 命令行参数 |

## 数据结构

### Config 配置结构

```jsonc
{
  "server": {                       // 服务端配置
    "host": "",                     // 监听地址 (空→127.0.0.1, "true"→0.0.0.0)
    "port": "",                     // 监听端口 (空→11411, 或 "${env:PORT}")
    "api_key": ""                   // 北向 API 密钥 (直接值或 "${env:VAR_NAME}")
  },
  "aliases": {                      // 模型别名映射（支持字符串和加权两种格式）
    // 字符串格式（向后兼容）
    "deepseek-v4-pro": "deepseek/deepseek-v4-pro",
    "o1": "openai/o1-mini",

    // 加权格式：多个后端按权重随机选择，带失败回退
    "glm5.1": {
      "aliyun/glm5.1": { "weight": 0.2 },
      "baidu/glm5.1": { "weight": 0.4 },
      "disabled-backend/model": { "weight": 0.3, "disabled": true },
      "deepseek/glm5.1": { "weight": 0.3, "fallback": true }
    }
  },
  "backends": [                     // 后端列表 (至少 1 个)
    {
      "name": "deepseek",           // 后端名称
      "base_url": "https://api.deepseek.com/chat/completions",
                                    // 后端 API 地址
      "prefix": "deepseek/",        // 模型前缀，用于路由
      "default": true,              // 默认后端 (仅一个为 true)
      "disabled": false,           // 是否禁用此后端 (true 则忽略，默认 false)
      "require_api_key": true,      // 是否需要注入 API Key
      "api_key": "${env:DEEPSEEK_API_KEY}",  // API Key (直接值或 ${env:} 引用)
      "role_rewrites": {            // 角色重写映射
        "developer": "system"
      },
      "unsupported_params": [       // 不支持参数列表
        "reasoning_effort", "top_logprobs", "logprobs"
      ]
    }
  ]
}
```

### 路由权重配置

别名支持 **加权多后端路由**，实现自动负载分散和失败回退：

- `weight` — 路由权重（正数），决定该后端被选中的概率。系统自动归一化，无需总和为 1.0
- `fallback` — 回退标记（可选，默认 `false`）。标记为 `true` 的后端也会参与正常加权选择，当正常选中的后端请求失败时按权重降序依次尝试 fallback 目标
- `disabled` — 禁用标记（可选，默认 `false`）。标记为 `true` 的目标不参与加权选择，也不会被纳入回退列表。适用于临时关闭某个后端或模型而不删除配置

**示例：** 请求 `"glm5.1"` 时，aliyun 有 20% 概率被选中，baidu 有 40% 概率，deepseek 有 40% 概率（也参与正常选择）。若选中的后端返回错误，自动回退到标记了 fallback 的 deepseek 重试。

字符串格式的别名（如 `"o1": "openai/o1-mini"`）行为不变。

### 认证优先级

```
命令行 --api-key > 配置文件 server.api_key 字段 > 自动生成 rsk_***
```

## 快速开始

### 1. 安装依赖

```bash
git clone <repo-url> && cd llm-router
npm install
```

### 2. 创建配置文件

```bash
cp config.example.json config.json
# 编辑 config.json 配置你的后端
```

```jsonc
{
  "server": {
    "host": "",
    "port": "11411",
    "api_key": ""
  },
  "backends": [
    {
      "name": "openai",
      "base_url": "https://api.openai.com/chat/completions",
      "prefix": "openai/",
      "default": true,
      "require_api_key": true,
      "api_key": "${env:OPENAI_API_KEY}"
    }
  ]
}
```

### 3. 设置 API 密钥

```bash
# 推荐：通过环境变量
export LLMROUTER_API_KEY="sk-your-key-here"
export OPENAI_API_KEY="sk-..."
export DEEPSEEK_API_KEY="sk-..."

# 或通过命令行
npx ts-node src/app.ts --api-key="sk-your-key-here"
```

> 如不设置 `LLMROUTER_API_KEY`，服务启动时会自动生成密码学安全的随机密钥并打印到控制台。

### 4. 启动服务

```bash
# 开发模式 (ts-node + nodemon 热重载)
npm run dev

# 生产模式 (先编译再运行)
npm run build && node dist/app.js
```

### 5. 测试

```bash
# 健康检查
curl http://localhost:11411/health -H "Authorization: Bearer YOUR_API_KEY"

# Chat Completions (前缀路由)
curl -X POST http://localhost:11411/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'

# 使用别名
curl -X POST http://localhost:11411/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"o1","messages":[{"role":"user","content":"Hello"}]}'
```

### 6. 在 Cursor 中配置

| 设置项 | 值 |
|--------|-----|
| OpenAI Base URL | `http://<your-host>:11411/` |
| OpenAI API Key | `LLMROUTER_API_KEY` 的值 |

然后在 Cursor 中使用带前缀的模型名替代普通模型名：

| 普通模型名 | Cursor 中使用的模型名 |
|-----------|---------------------|
| `gpt-4o-mini` | `openai/gpt-4o-mini` |
| `deepseek-chat` | `deepseek/deepseek-chat` |
| `deepseek-v4-pro`（别名 → `deepseek/deepseek-v4-pro`） | `deepseek-v4-pro` |

## 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-c, --config <path>` | `config.json` | 配置文件路径 (支持 .json/.yaml/.yml) |
| `-h, --host <ip>` | 配置文件值 | 监听地址 (覆盖配置文件) |
| `-p, --port <port>` | 配置文件值 | 监听端口 (覆盖配置文件) |
| `-k, --api-key <key>` | (无) | 直接指定 API 密钥 |
| `--log-level <level>` | `warn` | 日志级别 (debug/info/warn/error) |

## 项目结构

```
src/
├── app.ts                  # 入口：加载配置 → 初始化代理 → 创建路由 → 启动服务
├── config/
│   ├── index.ts            # 配置加载流水线 (CLI → .env → 文件 → Zod 校验)
│   └── schema.ts           # 重导出 Zod Schema
├── handler/
│   └── chatHandler.ts      # Chat Completions 请求处理 (别名 → 路由 → 过滤)
├── logger/
│   └── index.ts            # Winston 结构化日志器工厂
├── middleware/
│   ├── auth.ts             # Bearer Token 认证
│   ├── cors.ts             # CORS 头 + OPTIONS 预检
│   └── preprocessor.ts     # 别名映射、角色重写、参数过滤
├── proxy/
│   ├── director.ts         # 代理请求改写 (注入/移除 Authorization, proxy headers)
│   └── index.ts            # 代理实例初始化 (http-proxy-middleware)
├── routes/
│   └── index.ts            # 路由注册 (cors → auth → /health → /chat/completions → 默认)
├── types/
│   └── index.ts            # Zod Schema + TypeScript 类型 + 错误格式化
└── utils/
    ├── index.ts            # 统一导出
    ├── keygen.ts           # generateStrongAPIKey()
    ├── redact.ts           # redactAuthorization()
    └── stream.ts           # drainBody, recordResponse, reassembleSSE
specs/                       # 完整规格文档 (规范、计划、数据模型、API 契约)
```

## 规范文档

项目包含完整的 Spec Kit 规范文档，详见 [`specs/`](./specs/) 目录：

| 文档 | 说明 |
|------|------|
| [`overall-spec.md`](./specs/overall-spec.md) | 13 项功能需求 + 6 项非功能需求 |
| [`overall-plan.md`](./specs/overall-plan.md) | 技术选型与实施规划 |
| [`overall-data-model.md`](./specs/overall-data-model.md) | 完整数据模型定义 (Zod Schema) |
| [`overall-api.md`](./specs/overall-api.md) | API 端点与数据结构规格 |
| [`overall-test-cases.md`](./specs/overall-test-cases.md) | 测试用例 |
| [`constitution.md`](./specs/constitution.md) | 7 项项目准则 |
| 6 个模块目录 | 各模块的 spec.md + plan.md + tasks.md |

## License

MIT
