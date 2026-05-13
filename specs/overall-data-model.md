# LLM-Router 数据模型

> 生成时间: 2026-05-11 | 基于 Go 参考项目规格适配 TypeScript/Express 实现
> 源码位置: `src/types/index.ts`, `src/config/schema.ts`

## 核心实体

### BackendConfig

后端服务配置，定义一个 LLM 提供商的路由规则。

| 字段 | TypeScript 类型 | Zod 类型 | JSON 键 | 必填 | 默认值 | 说明 |
|------|----------------|---------|---------|------|--------|------|
| `name` | `string` | `z.string()` | `name` | 是 | - | 后端名称，如 `"openai"`, `"deepseek"` |
| `baseUrl` | `string` | `z.string().url()` | `base_url` | 是 | - | 后端 API 基础 URL，如 `"https://api.openai.com/v1"` |
| `prefix` | `string` | `z.string()` | `prefix` | 是 | - | 模型前缀，如 `"openai/"`，用于路由匹配 |
| `default` | `boolean` | `z.boolean()` | `default` | 否 | `false` | 是否为默认后端（仅一个可为 true） |
| `requireApiKey` | `boolean` | `z.boolean()` | `require_api_key` | 否 | `false` | 后端是否需要 API 密钥认证 |
| `apiKey` | `string` | `z.string()` | `api_key` | 否 | `""` | API 密钥值或 `${env:VAR_NAME}` 环境变量引用 |
| `roleRewrites` | `Record<string, string>` | `z.record(z.string(), z.string())` | `role_rewrites` | 否 | `{}` | 消息角色重写映射，如 `{"developer": "system"}` |
| `unsupportedParams` | `string[]` | `z.array(z.string())` | `unsupported_params` | 否 | `[]` | 需要移除的不支持参数名列表 |

**Zod Schema**:

```typescript
const BackendConfigSchema = z.object({
  name: z.string().min(1),
  base_url: z.string().url(),
  prefix: z.string().min(1),
  default: z.boolean().default(false),
  require_api_key: z.boolean().default(false),
  api_key: z.string().default(""),
  role_rewrites: z.record(z.string(), z.string()).default({}),
  unsupported_params: z.array(z.string()).default([]),
});
```

**TypeScript 类型** (从 Zod Schema 推断):

```typescript
type BackendConfig = z.infer<typeof BackendConfigSchema>;
```

### Config

全局配置，包含服务端口、后端列表、认证信息和模型别名。

| 字段 | TypeScript 类型 | Zod 类型 | JSON 键 | 必填 | 默认值 | 说明 |
|------|----------------|---------|---------|------|--------|------|
| `listeningPort` | `number` | `z.number().int().positive()` | `listening_port` | 否 | `11411` | HTTP 服务监听端口 |
| `backends` | `BackendConfig[]` | `z.array(BackendConfigSchema)` | `backends` | 是 | - | 后端配置列表 |
| `llmrouterApiKey` | `string` | `z.string()` | `llmrouter_api_key` | 否 | `""` | API 密钥值或 `${env:VAR_NAME}` 环境变量引用 |
| `llmrouterApiKey` | `string` | - | (运行时) | 否 | `""` | LLM-Router API 密钥值（运行时确定） |
| `useGeneratedKey` | `boolean` | - | (运行时) | 否 | `false` | 是否使用自动生成的密钥 |
| `aliases` | `Record<string, string>` | `z.record(z.string(), z.string())` | `aliases` | 否 | `{}` | 模型别名映射 |
| `logger` | `Logger` | - | (运行时) | 否 | - | Winston 日志器实例 |

**Zod Schema**:

```typescript
const ConfigSchema = z.object({
  listening_port: z.number().int().positive().default(11411),
  backends: z.array(BackendConfigSchema).min(1),
  llmrouter_api_key: z.string().default(""),
  aliases: z.record(z.string(), z.string()).default({}),
});
```

**TypeScript 类型** (从 Zod Schema 推断):

```typescript
type Config = z.infer<typeof ConfigSchema> & {
  llmrouterApiKey?: string;  // 运行时确定
  useGeneratedKey?: boolean; // 运行时确定
  logger?: Logger;            // 运行时注入
};
```

## 实体关系

```
Config
  ├── 1:N → BackendConfig (后端配置列表)
  │         ├── name (标识)
  │         ├── prefix (路由键)
  │         ├── baseUrl (目标地址)
  │         ├── roleRewrites (角色映射)
  │         └── unsupportedParams (参数过滤)
  │
  ├── 1:1 → Logger (Winston 日志器)
  │
  └── 1:N → Aliases (模型别名映射)
        ├── Key: 客户端使用的短名 (如 "o1")
        └── Value: 展开后的完整模型名 (如 "groq/deepseek-r1")
```

## 运行时数据结构

### ProxyMap

```
ProxyMap: Map<string, RequestHandler>
  ├── Key: 后端前缀 (如 "openai/", "ollama/")
  └── Value: http-proxy-middleware 创建的代理处理函数

DefaultProxy: RequestHandler | null
  └── 默认后端的代理处理函数（无前缀匹配时使用）
```

### Request 上下文

```
RequestContext (附加到 Express Request 对象):
  ├── matchedBackend: BackendConfig | null
  ├── originalModel: string (原始模型名)
  ├── resolvedModel: string (别名展开后的模型名)
  ├── targetModel: string (移除前缀后的模型名)
  └── isStreaming: boolean (是否为流式请求)
```

## 与 Go 版本数据模型对比

| Go 字段 | TypeScript 字段 | 说明 |
|---------|----------------|------|
| `ListeningPort` | `listeningPort` | 驼峰命名 → 配置文件使用 snake_case |
| `Backends` | `backends` | 数组类型，结构相同 |
| `LLMRouterAPIKeyEnv` | `llmrouterApiKey` | 运行时确定，支持直接值或 `${env:}` 语法 |
| `LLMRouterAPIKey` | `llmrouterApiKey` | 运行时属性，不在 JSON 中 |
| `UseGeneratedKey` | `useGeneratedKey` | 运行时属性，不在 JSON 中 |
| `Aliases` | `aliases` | Record 类型，结构相同 |
| `Logger *zap.Logger` | `logger Logger` | Winston 替代 Zap |
| `Name` | `name` | BackendConfig |
| `BaseURL` | `baseUrl` | URL 字段 |
| `Prefix` | `prefix` | 路由前缀 |
| `Default` | `default` | 布尔值 |
| `RequireAPIKey` | `requireApiKey` | Go 大写 → TS camelCase |
| `KeyEnvVar` | `apiKey` | API 密钥值或 `${env:}` 变量引用 |
| `RoleRewrite` | `roleRewrites` | Go map → TS Record |
| `UnsupportedParams` | `unsupportedParams` | Go 切片 → TS 数组 |