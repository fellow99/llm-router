# 在 config.json 中读取环境变量 (103) 测试用例

> 需求编号: 103-json-use-env
> 基于: spec.md, plan.md
> 生成时间: 2026-05-13

## 测试环境准备

| 项目 | 说明 |
|------|------|
| 配置文件 | `test.config.json`（已存在，新格式） |
| 环境变量文件 | `.env` 或通过 shell export |
| 测试入口 | `npx ts-node src/app.ts --config test.config.json` |

---

## TC-ENV-001: `${env:VAR}` 语法 — 环境变量存在时正确读取

**前置条件**:
- `config.json` 中 `llmrouter_api_key` = `"${env:LLMROUTER_API_KEY}"`
- 环境变量 `LLMROUTER_API_KEY` = `"test-router-key-123"`
- 后端 `api_key` = `"${env:DEEPSEEK_API_KEY}"`
- 环境变量 `DEEPSEEK_API_KEY` = `"sk-test-deepseek-456"`

**测试步骤**:

1. 启动服务：`LLMROUTER_API_KEY=test-router-key-123 DEEPSEEK_API_KEY=sk-test-deepseek-456 npx ts-node src/app.ts --config test.config.json`

**期望结果**:
- 服务正常启动
- 日志显示 API key 已从环境变量加载（非 auto-generated）
- `RuntimeConfig.llmrouterApiKey` = `"test-router-key-123"`
- `resolveBackendApiKey(deepseekBackend)` = `"sk-test-deepseek-456"`
- 不会输出自动生成 key 的提示

---

## TC-ENV-002: `${env:VAR}` 语法 — 环境变量不存在时回退

**前置条件**:
- `config.json` 中 `llmrouter_api_key` = `"${env:NONEXISTENT_VAR}"`
- 环境变量 `NONEXISTENT_VAR` 未设置

**测试步骤**:

1. 启动服务（确保 `NONEXISTENT_VAR` 未设置）

**期望结果**:
- 服务正常启动
- `RuntimeConfig.llmrouterApiKey` 为自动生成的 `rsk_` 前缀密钥
- `RuntimeConfig.useGeneratedKey` = `true`
- 控制台输出自动生成 key 的提示信息
- 后端 `api_key` 为 `${env:NONEXISTENT}` → `resolveBackendApiKey` 返回 null → 不注入 Authorization

---

## TC-ENV-003: 直接 key 值

**前置条件**:
- `config.json` 中 `llmrouter_api_key` = `"my-direct-router-key"`
- 后端 `api_key` = `"sk-direct-backend-key"`

**测试步骤**:

1. 启动服务

**期望结果**:
- `RuntimeConfig.llmrouterApiKey` = `"my-direct-router-key"`
- `resolveBackendApiKey(backend)` = `"sk-direct-backend-key"`
- 不尝试读取任何环境变量

---

## TC-ENV-004: 字段为空字符串

**前置条件**:
- `config.json` 中 `llmrouter_api_key` = `""`
- 后端 `api_key` = `""`

**测试步骤**:

1. 启动服务

**期望结果**:
- `RuntimeConfig.llmrouterApiKey` 为自动生成的 `rsk_` 密钥
- `RuntimeConfig.useGeneratedKey` = `true`
- `resolveBackendApiKey(backend)` → null（空字符串 → resolveEnvValue 返回 undefined）
- 如果 `backend.require_api_key` = true，不注入 Authorization header

---

## TC-ENV-005: Zod Schema 验证 — 新字段接受

**前置条件**:
- `config.json` 包含 `llmrouter_api_key` 和 `api_key`（新字段名）

**测试步骤**:

1. 启动服务

**期望结果**:
- 配置通过 Zod 验证
- 无验证错误输出
- 服务正常启动

---

## TC-ENV-006: Zod Schema 验证 — 旧字段名拒绝

**前置条件**:
- `config.json` 包含旧字段名 `llmrouter_api_key_env` 或 `key_env_var`

**测试步骤**:

1. 使用旧格式配置文件启动服务

**期望结果**:
- Zod 验证失败（字段名不被识别，取决于是否使用 `strictObject`）
- 输出明确的验证错误信息
- 进程退出码为 1

> **注意**: 如果 ConfigSchema 使用 `z.object()`（默认允许额外字段），旧字段不会导致验证失败，但也不会生效。需要确认是否需要显式拒绝旧字段。根据 spec.md，旧字段应明确报错。

---

## TC-ENV-007: CLI 参数 — --llmrouter-api-key 仍然有效

**前置条件**: 任意配置文件

**测试步骤**:

1. `npx ts-node src/app.ts --config config.json --llmrouter-api-key "cli-secret-key"`

**期望结果**:
- `RuntimeConfig.llmrouterApiKey` = `"cli-secret-key"`
- CLI 参数优先级最高，覆盖配置文件和环境变量

---

## TC-ENV-008: CLI 参数 — --llmrouter-api-key-env 已移除

**前置条件**: 无

**测试步骤**:

1. `npx ts-node src/app.ts --llmrouter-api-key-env SOME_VAR`

**期望结果**:
- 命令行解析器报错：未知选项（或忽略该参数）
- 不应有静默忽略行为（commander 默认行为是报错 unknown option）

---

## TC-ENV-009: CLI 参数 — --help 不展示已移除参数

**前置条件**: 无

**测试步骤**:

1. `npx ts-node src/app.ts --help`

**期望结果**:
- 帮助信息中不包含 `--llmrouter-api-key-env`
- 帮助信息中包含 `--llmrouter-api-key`

---

## TC-ENV-010: 默认配置启动

**前置条件**: 无 config.json（或 config.json 不存在）

**测试步骤**:

1. `npx ts-node src/app.ts --config nonexistent.json`

**期望结果**:
- 使用 DEFAULT_CONFIG 启动
- `config.llmrouter_api_key` = `""`（新字段，非旧 `llmrouter_api_key_env`）
- 自动生成 `rsk_` 密钥
- 后端默认使用 openai 配置（无 api_key）
- 提示信息引用正确的字段名和语法

---

## TC-ENV-011: 混合格式 — 部分直接值、部分 ${env:}

**前置条件**:
- `llmrouter_api_key` = `"${env:LLMROUTER_API_KEY}"`
- 后端 A: `api_key` = `"sk-hardcoded-key"`
- 后端 B: `api_key` = `"${env:DEEPSEEK_API_KEY}"`

**测试步骤**:

1. 设置 `LLMROUTER_API_KEY` = `"env-key"`
2. 设置 `DEEPSEEK_API_KEY` = `"env-backend-key-2"`
3. 启动服务

**期望结果**:
- 北向 key = `"env-key"`（来自环境变量）
- 后端 A key = `"sk-hardcoded-key"`（直接值）
- 后端 B key = `"env-backend-key-2"`（来自环境变量）
- 三者互不干扰

---

## TC-ENV-012: `${env:}` 语法边界情况

**前置条件**: 配置文件

**测试步骤**:

测试以下值的行为：

| 配置值 | 期望行为 |
|--------|---------|
| `"${env:}"` | 不匹配正则（变量名为空），视为直接值 `"${env:}"` |
| `"${env:VAR_NAME"` | 不匹配正则（缺少 }），视为直接值 |
| `" ENV:VAR}"` | 不匹配正则，视为直接值 |
| `"${ENV:VAR}"` | 不匹配正则（大小写敏感），视为直接值 |
| `"prefix${env:VAR}suffix"` | 不匹配正则（非独占），视为直接值 |
| `"${env:VAR_WITH_UNDERSCORE}"` | 正确匹配，读取 `process.env.VAR_WITH_UNDERSCORE` |

**验证**: 所有边界情况行为一致，不会意外触发环境变量读取

---

## TC-ENV-013: TypeScript 编译通过

**前置条件**: 所有代码变更完成

**测试步骤**:

1. `npm run build` (或 `npx tsc --noEmit`)

**期望结果**:
- 零 TypeScript 编译错误
- 所有类型正确推导，无需 `as any` 或 `@ts-ignore`

---

## TC-ENV-014: 日志验证 — API Key 脱敏

**前置条件**: 任意配置

**测试步骤**:

1. 设置 API key 并启动服务
2. 检查日志输出

**期望结果**:
- 日志中不存在明文 API key（auth middleware 使用 `redactAuthorization`）
- 如后端 key 解析失败，warn 日志不泄露 key 值

---

## 测试通过标准

| 类别 | 通过条件 |
|------|---------|
| 功能正确性 | TC-ENV-001~004 全部通过 |
| 格式验证 | TC-ENV-005~006 全部通过 |
| CLI 兼容性 | TC-ENV-007~009 全部通过 |
| 默认行为 | TC-ENV-010 通过 |
| 混合场景 | TC-ENV-011 通过 |
| 边界情况 | TC-ENV-012 通过 |
| 编译/构建 | TC-ENV-013 通过 |
| 安全性 | TC-ENV-014 通过 |
