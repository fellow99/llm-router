# 数据模型模块 (004) 功能规格

> 模块路径: `src/types/` + `src/config/schema.ts`
> 生成时间: 2026-05-11

## 概述

数据模型模块定义了系统核心的 TypeScript 类型和 Zod Schema，是配置验证和类型安全的基础。使用 Zod Schema 作为唯一数据来源，TypeScript 类型通过 `z.infer` 自动推断。

## 功能需求

### FR-MDL-001: Config Schema 定义

- 定义 `ConfigSchema` 包含所有配置字段
- 所有字段提供合理的默认值
- 必填字段使用 `.min(1)` 等验证规则
- 数值字段使用 `.int().positive()` 验证

### FR-MDL-002: BackendConfig Schema 定义

- 定义 `BackendConfigSchema` 包含后端配置字段
- `name` 和 `prefix` 为必填非空字符串
- `base_url` 为必填且格式为合法 URL
- `default`、`require_api_key` 默认为 `false`
- `role_rewrites` 默认为空对象 `{}`
- `unsupported_params` 默认为空数组 `[]`

### FR-MDL-003: TypeScript 类型推断

- 使用 `z.infer<typeof ConfigSchema>` 自动推断 `Config` 类型
- 使用 `z.infer<typeof BackendConfigSchema>` 自动推断 `BackendConfig` 类型
- 运行时扩展字段（`llmrouterApiKey`、`useGeneratedKey`、`logger`）使用接口扩展

### FR-MDL-004: 配置验证

- 所有配置数据必须通过 Zod Schema 验证才能使用
- 验证失败时输出 `ZodError` 的详细错误信息
- 验证失败时进程退出码为 1
- 支持部分验证（仅验证必需字段）

### FR-MDL-005: 序列化/反序列化

- 支持从 JSON 格式反序列化配置
- 支持从 YAML 格式反序列化配置
- JSON/YAML 配置使用 snake_case 字段名
- TypeScript 内部使用 camelCase
- Zod `transform` 处理字段名映射

## 核心类型定义

### Config

```typescript
// 从 Zod Schema 推断的基础类型
type BaseConfig = z.infer<typeof ConfigSchema>;

// 运行时扩展
interface Config extends BaseConfig {
  llmrouterApiKey: string;
  useGeneratedKey: boolean;
  logger: Logger;
}
```

### BackendConfig

```typescript
type BackendConfig = z.infer<typeof BackendConfigSchema>;
```

### ChatCompletionRequest

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'developer' | string;
  content: string | null;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}
```

## 与 Go 版本对照

| Go 类型 | TypeScript 类型 | 说明 |
|---------|---------------|------|
| `Config` struct | `Config` interface (Zod 推断 + 扩展) | 新增运行时字段 |
| `BackendConfig` struct | `BackendConfig` type (Zod 推断) | Zod Schema 驱动 |
| `struct` tags | Zod Schema | 运行时验证 + 类型推断 |
| `json.Unmarshal` | jsonc-parser / yaml | 多格式解析 |
| 无 | Zod Schema 验证 | 新增：运行时安全保障 |