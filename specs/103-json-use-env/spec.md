# 在 config.json 中读取环境变量 (103) 功能规格

> 需求编号: 103-json-use-env
> 模块路径: `src/config/`, `src/types/`, `src/proxy/director.ts`
> 生成时间: 2026-05-13

## 概述

将 `config.json` 中 API KEY 字段从“间接环境变量名引用”改为“直接值 + `${env:VAR}` 环境变量插值”。变更涉及北向路由认证密钥（`llmrouter_api_key_env` → `llmrouter_api_key`）和南向后端平台密钥（`key_env_var` → `api_key`），同时支持直接写入 key 值和使用 `${env:VAR_NAME}` 语法读取环境变量。

## 功能需求

### FR-ENV-001: 北向 API KEY 字段变更

- **移除** `llmrouter_api_key_env` 字段（原值为环境变量名称字符串）
- **新增** `llmrouter_api_key` 字段，值支持两种格式：
  - 直接写入 key 值，如 `"sk-abc123"`
  - 环境变量引用，如 `"${env:LLMROUTER_API_KEY}"`，表示读取 `LLMROUTER_API_KEY` 环境变量
- 默认值改为空字符串 `""`（不再默认指向 `LLMROUTER_API_KEY`）

### FR-ENV-002: 南向 API KEY 字段变更

- **移除** `key_env_var` 字段（原值为环境变量名称字符串或直接 key 值）
- **新增** `api_key` 字段，值支持两种格式：
  - 直接写入 key 值，如 `"sk-abc123"`
  - 环境变量引用，如 `"${env:DEEPSEEK_API_KEY}"`

### FR-ENV-003: `${env:VAR_NAME}` 语法

- 在配置解析阶段（或 key 解析阶段）识别 `${env:VAR_NAME}` 格式
- 将 `VAR_NAME` 部分作为环境变量名，通过 `process.env[VAR_NAME]` 读取实际值
- 正则匹配模式：`/^\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/`
- 如果 `${env:VAR_NAME}` 中的环境变量不存在：
  - 北向 key：回退到自动生成 key（与现有三级回退逻辑一致）
  - 南向 key：记录 warn 日志，不注入 Authorization header

### FR-ENV-004: 直接值支持

- 如果字段值不以 `${env:` 开头，则视为直接 key 值
- 直接值可直接使用，无需环境变量查表
- 保持向后兼容：原 `key_env_var` 中直接写入 key 值的用法在新字段中继续有效

### FR-ENV-005: Zod Schema 更新

- `ConfigSchema`：
  - 移除 `llmrouter_api_key_env: z.string().default("LLMROUTER_API_KEY")`
  - 新增 `llmrouter_api_key: z.string().default("")`
- `BackendConfigSchema`：
  - 移除 `key_env_var: z.string().default("")`
  - 新增 `api_key: z.string().default("")`
- `RuntimeConfig` 接口保持 `llmrouterApiKey: string` 字段不变（值为解析后的实际 key）

### FR-ENV-006: resolveApiKey 适配

`src/config/index.ts` 中的 `resolveApiKey()` 函数需适配新逻辑：

1. CLI `--llmrouter-api-key` 优先（不变）
2. 检查 `config.llmrouter_api_key`：
   - 如果匹配 `${env:VAR}` 格式 → 读取 `process.env[VAR]`
   - 如果环境变量存在 → 使用环境变量值
   - 如果是直接值（非 `${env:` 开头且非空）→ 使用直接值
   - 如果为空 → 跳过
3. 自动生成 `rsk_` 前缀密钥（不变）

### FR-ENV-007: resolveBackendApiKey 适配

`src/proxy/director.ts` 中的 `resolveBackendApiKey()` 函数需适配新逻辑：

1. 如果 `require_api_key` 为 false → 返回 null（不变）
2. 检查 `backend.api_key`：
   - 如果匹配 `${env:VAR}` 格式 → 读取 `process.env[VAR]`
   - 如果环境变量存在 → 返回环境变量值
   - 如果是直接值（非 `${env:` 开头且非空）→ 返回直接值
   - 如果为空 → 继续向下
3. OpenAI fallback：`OPENAI_API_KEY` 环境变量（不变）

### FR-ENV-008: 默认配置更新

`src/config/index.ts` 中的 `DEFAULT_CONFIG` 常量更新：

- `llmrouter_api_key_env: 'LLMROUTER_API_KEY'` → `llmrouter_api_key: ''`
- 后端数组中的 `key_env_var` 如果存在 → 替换为 `api_key`

### FR-ENV-009: CLI 参数兼容

- 保留 `--llmrouter-api-key` 命令行参数（不变，仍为直接 key 值）
- 移除 `--llmrouter-api-key-env` 命令行参数（不再需要指定环境变量名称）
- 移除 `src/config/index.ts` 中 `cli.llmrouterApiKeyEnv` 对 `config.llmrouter_api_key_env` 的覆盖逻辑

### FR-ENV-010: 文档更新

- **specs/001-config-module/spec.md**：更新 FR-CFG-006（API 密钥三级回退）、FR-CFG-003（命令行参数）、FR-CFG-007（默认配置）中的相关描述
- **specs/001-config-module/plan.md**：更新 Schema 设计、API 密钥回退策略代码示例
- **README.md**：更新 `config.json` 配置示例，展示新的 `llmrouter_api_key` 和 `api_key` 字段及 `${env:VAR}` 语法

## 关键数据流

### 配置加载流（变更后）

```
loadConfig()
  │
  ├── 1. parseCommandLine() → CLI 参数（移除 --llmrouter-api-key-env）
  ├── 2. dotenv.config() → 加载 .env
  ├── 3. loadConfigFile(path) → 读取 JSON/YAML
  ├── 4. validateConfig(raw) → Zod Schema 验证（新字段名）
  ├── 5. applyOverrides (port only)
  ├── 6. resolveApiKey(config, cliKey):
  │     ├── cliKey 存在 → 直接使用
  │     ├── config.llmrouter_api_key 为 "${env:VAR}" → process.env[VAR]
  │     ├── config.llmrouter_api_key 为直接值且非空 → 直接使用
  │     └── 否则 → 自动生成 rsk_ 密钥
  └── 7. return RuntimeConfig
```

### 后端 Key 解析流（变更后）

```
resolveBackendApiKey(backend)
  │
  ├── !backend.require_api_key → null
  ├── backend.api_key 匹配 "${env:VAR}" → process.env[VAR]
  ├── backend.api_key 为非空直接值 → 返回直接值
  ├── backend.name 含 "openai" → process.env.OPENAI_API_KEY
  └── 否则 → null
```

### config.json 结构变更

```diff
{
  "listening_port": 11411,
- "llmrouter_api_key_env": "LLMROUTER_API_KEY",
+ "llmrouter_api_key": "${env:LLMROUTER_API_KEY}",
  "aliases": { ... },
  "backends": [
    {
      "name": "deepseek",
      "base_url": "https://api.deepseek.com",
      "prefix": "deepseek/",
      "default": true,
      "require_api_key": true,
-     "key_env_var": "DEEPSEEK_API_KEY"
+     "api_key": "${env:DEEPSEEK_API_KEY}"
    }
  ]
}
```

## 受影响文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/types/index.ts` | 修改 | ConfigSchema, BackendConfigSchema 字段变更 |
| `src/config/index.ts` | 修改 | resolveApiKey 逻辑、DEFAULT_CONFIG、CLI 参数 |
| `src/proxy/director.ts` | 修改 | resolveBackendApiKey 逻辑适配 `api_key` |
| `src/config/schema.ts` | 不变 | 通过 re-export types 自动更新 |
| `src/middleware/auth.ts` | 不变 | 使用 RuntimeConfig.llmrouterApiKey（已解析值） |
| `specs/001-config-module/spec.md` | 更新 | FR-CFG-003/006/007 |
| `specs/001-config-module/plan.md` | 更新 | Schema 设计、回退策略 |
| `README.md` | 更新 | config.json 配置说明 |
| `test.config.json` | 参考 | 已是新格式（作为参考文件） |

## 约束

- 不引入新的外部依赖
- `${env:}` 语法仅支持环境变量引用，不支持嵌套/默认值
- TypeScript strict mode，不使用 `any`/`@ts-ignore`
- 保持 `RuntimeConfig.llmrouterApiKey` 字段不变（已解析的最终 key 值）
- 保持 `RuntimeConfig.useGeneratedKey` 语义不变
- 向后兼容：原 `key_env_var` 中直接写 key 值的用法，在新 `api_key` 字段中作为直接值同样有效
- 不破坏现有 CI/构建流程
