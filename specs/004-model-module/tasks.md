# 004 数据模型模块 — 开发任务

> 依赖: 无（基础模块，所有其他模块依赖此模块）
> 源码路径: `src/types/index.ts`, `src/config/schema.ts`

## Phase 1: Schema 定义

- [ ] T004-01: 创建 `src/types/index.ts`，定义 BackendConfigSchema
  - 输入: 004-model-module/spec.md FR-MDL-002
  - 输出: `src/types/index.ts` 包含 BackendConfigSchema Zod 定义
  - 验收: Schema 包含 name(min1), base_url(url), prefix(min1), default(bool→false), require_api_key(bool→false), api_key(string→""), role_rewrites(record→{}), unsupported_params(array→[])
  - 文件: `src/types/index.ts`

- [ ] T004-02: 在同一文件定义 ConfigSchema
  - 输入: 004-model-module/spec.md FR-MDL-001
  - 输出: ConfigSchema 引用 BackendConfigSchema，包含 listening_port(int+→11411), llmrouter_api_key(string→""), aliases(record→{}), backends(array.min1)
  - 验收: `z.infer<typeof ConfigSchema>` 产生正确的 TypeScript 类型
  - 文件: `src/types/index.ts`

## Phase 2: 类型导出

- [ ] T004-03: 导出 TypeScript 类型
  - 输入: 004-model-module/plan.md §5
  - 输出: `export type BackendConfig = z.infer<typeof BackendConfigSchema>`, `export type Config = z.infer<typeof ConfigSchema>`, RuntimeConfig 接口扩展（llmrouterApiKey, useGeneratedKey, logger）
  - 验收: 其他模块可 `import { Config, BackendConfig, ConfigSchema } from '../types'`
  - 文件: `src/types/index.ts`

- [ ] T004-04: 定义 ChatCompletion 请求类型
  - 输入: 004-model-module/spec.md FR-MDL-005
  - 输出: ChatMessage 接口（role, content）, ChatCompletionRequest 接口（model, messages, stream?, temperature? 等 + 索引签名）
  - 验收: 类型与 OpenAI Chat Completions API 兼容
  - 文件: `src/types/index.ts`

## Phase 3: 验证工具

- [ ] T004-05: 实现 Zod 错误格式化函数
  - 输入: 004-model-module/plan.md §4
  - 输出: `formatZodError(error: ZodError): string` 函数，将 Zod 验证错误转为可读多行字符串
  - 验收: 错误格式为 `  - path.to.field: error message`
  - 文件: `src/types/index.ts`