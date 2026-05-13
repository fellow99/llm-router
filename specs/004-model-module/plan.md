# 数据模型模块 (004) 技术方案

> 模块路径: `src/types/` + `src/config/schema.ts`
> 生成时间: 2026-05-11

## 1. 技术选型

| 技术 | 用途 | 理由 |
|------|------|------|
| Zod | Schema 定义与验证 | 运行时验证 + TypeScript 类型推断 |
| TypeScript | 类型系统 | 严格模式，`strict: true` |

## 2. 模块结构

```
src/types/
  └── index.ts        # 通用类型导出（ChatMessage, ChatCompletionRequest 等）

src/config/
  └── schema.ts       # Zod Schema 定义（ConfigSchema, BackendConfigSchema）
```

## 3. Schema 设计原则

### 单一来源原则

Zod Schema 是数据类型的唯一来源。TypeScript 类型通过 `z.infer` 自动推断，避免双维护问题。

```typescript
// 正确：从 Schema 推断类型
export type BackendConfig = z.infer<typeof BackendConfigSchema>;

// 错误：单独定义类型
// interface BackendConfig { name: string; ... }  ← 不维护
```

### 字段映射

JSON/YAML 配置使用 snake_case，TypeScript 内部使用 camelCase。

```typescript
// Zod Schema 使用 snake_case（与 JSON/YAML 对应）
const BackendConfigSchema = z.object({
  base_url: z.string().url(),     // JSON: base_url
  require_api_key: z.boolean(),   // JSON: require_api_key
});

// TypeScript 内部通过 z.transform 转换为 camelCase
// 或在代码中使用解构映射
```

### 运行时分离

配置文件中的字段（Zod Schema 定义）和运行时字段（接口扩展）分离：

```typescript
// 配置文件字段
type BaseConfig = z.infer<typeof ConfigSchema>;

// 运行时扩展
interface Config extends BaseConfig {
  llmrouterApiKey: string;    // 运行时从环境变量或自动生成
  useGeneratedKey: boolean;   // 运行时标志
  logger: Logger;              // 运行时注入
}
```

## 4. 完整 Schema 定义

### BackendConfigSchema

```typescript
export const BackendConfigSchema = z.object({
  name: z.string().min(1, "Backend name is required"),
  base_url: z.string().url("Invalid backend URL format"),
  prefix: z.string().min(1, "Backend prefix is required"),
  default: z.boolean().default(false),
  require_api_key: z.boolean().default(false),
  api_key: z.string().default(""),
  role_rewrites: z.record(z.string(), z.string()).default({}),
  unsupported_params: z.array(z.string()).default([]),
});
```

### ConfigSchema

```typescript
export const ConfigSchema = z.object({
  listening_port: z.number().int().positive().default(11411),
  llmrouter_api_key: z.string().default(""),
  aliases: z.record(z.string(), z.string()).default({}),
  backends: z.array(BackendConfigSchema).min(1, "At least one backend is required"),
});
```

### 验证错误格式化

```typescript
function formatZodError(error: ZodError): string {
  return error.errors.map(err =>
    `  - ${err.path.join('.')}: ${err.message}`
  ).join('\n');
}

// 使用示例:
const result = ConfigSchema.safeParse(rawConfig);
if (!result.success) {
  console.error('Configuration validation failed:\n' + formatZodError(result.error));
  process.exit(1);
}
```

## 5. 类型导出结构

```typescript
// src/types/index.ts
export type { Config, BackendConfig, ChatMessage, ChatCompletionRequest };
export { ConfigSchema, BackendConfigSchema };
export { formatZodError };
```

## 6. 改进方向

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 自定义校验器 | 端口范围、URL 可达性验证 | P3 |
| 条件依赖 | `require_api_key=true` 时 `api_key` 建议配置 | P2 |
| Schema 版本化 | 支持配置文件版本迁移 | P3 |