# 在 config.json 中读取环境变量 (103) 技术方案

> 需求编号: 103-json-use-env
> 生成时间: 2026-05-13

## 1. 技术架构

### 1.1 变更范围

```
src/
├── types/index.ts          # [修改] ConfigSchema, BackendConfigSchema
├── config/index.ts         # [修改] resolveApiKey, DEFAULT_CONFIG, CLI parser
├── config/schema.ts        # [不变] re-export from types
├── proxy/director.ts       # [修改] resolveBackendApiKey
└── middleware/auth.ts       # [不变] 使用 RuntimeConfig.llmrouterApiKey

specs/
├── 103-json-use-env/       # [新增] 本功能的 spec/plan/tasks/test-cases
├── 001-config-module/
│   ├── spec.md             # [更新] FR-CFG-003/006/007
│   └── plan.md             # [更新] Schema设计、回退策略示例

README.md                    # [更新] config.json 配置说明
test.config.json             # [不变] 已是新格式参考文件
```

### 1.2 核心变更流程

```
┌── 配置加载期 ──────────────────────────────────────────┐
│                                                         │
│  config.json 加载                                       │
│    │                                                    │
│    ├── Zod 验证 (新 Schema)                              │
│    │   ├── llmrouter_api_key: string (默认 "")           │
│    │   └── BackendConfig.api_key: string (默认 "")       │
│    │                                                    │
│    └── 字段解析 → 保持原值传入 Config                     │
│                                                         │
├── Key 解析期 ──────────────────────────────────────────┤
│                                                         │
│  resolveApiKey(config, cliKey)                          │
│    │                                                    │
│    ├── 1. cliKey (--llmrouter-api-key) → 直接使用        │
│    ├── 2. config.llmrouter_api_key                      │
│    │     ├── "${env:VAR}" → process.env[VAR]            │
│    │     ├── 非空直接值 → 直接使用                        │
│    │     └── 空 → 跳过                                   │
│    └── 3. 自动生成 rsk_ 密钥                             │
│                                                         │
│  resolveBackendApiKey(backend)                          │
│    │                                                    │
│    ├── 1. !backend.require_api_key → null               │
│    ├── 2. backend.api_key                               │
│    │     ├── "${env:VAR}" → process.env[VAR]            │
│    │     ├── 非空直接值 → 直接使用                        │
│    │     └── 空 → 跳过                                   │
│    └── 3. OPENAI_API_KEY fallback                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 2. 详细设计

### 2.1 Zod Schema 变更

```typescript
// src/types/index.ts — 变更后

// BackendConfig 移除 key_env_var，新增 api_key
export const BackendConfigSchema = z.object({
  name: z.string().min(1, "Backend name is required"),
  base_url: z.string().url("Invalid backend URL format"),
  prefix: z.string().min(1, "Backend prefix is required"),
  default: z.boolean().default(false),
  require_api_key: z.boolean().default(false),
  api_key: z.string().default(""),        // ← 新字段，替换 key_env_var
  role_rewrites: z.record(z.string(), z.string()).default({}),
  unsupported_params: z.array(z.string()).default([]),
});

// Config 移除 llmrouter_api_key_env，新增 llmrouter_api_key
export const ConfigSchema = z.object({
  listening_port: z.number().int().positive().default(11411),
  llmrouter_api_key: z.string().default(""),  // ← 新字段，替换 llmrouter_api_key_env
  aliases: z.record(
    z.string(),
    z.union([
      z.string(),
      z.record(z.string(), AliasTargetSchema),
    ]),
  ).default({}),
  backends: z.array(BackendConfigSchema).min(1, "At least one backend is required"),
});
```

### 2.2 `${env:}` 解析工具函数

```typescript
// src/config/index.ts — 新增工具函数

/** ${env:VAR_NAME} 匹配模式 */
const ENV_PLACEHOLDER_RE = /^\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/;

/**
 * 解析配置中的 API Key 值。
 * - "${env:VAR}" → 读取 process.env[VAR]
 * - 非空其他值 → 视为直接 key 值
 * - 空字符串 → 返回 undefined
 */
function resolveEnvValue(raw: string): string | undefined {
  if (!raw) return undefined;

  const match = raw.match(ENV_PLACEHOLDER_RE);
  if (match) {
    const envName = match[1];
    const envVal = process.env[envName];
    if (envVal) return envVal;
    // 环境变量不存在
    return undefined;
  }

  // 直接值
  return raw;
}
```

### 2.3 resolveApiKey 重写

```typescript
// src/config/index.ts — 重写

function resolveApiKey(
  config: Config,
  cliKey?: string,
  logger?: Logger,
): { key: string; generated: boolean } {
  // Priority 1: CLI argument
  if (cliKey) {
    return { key: cliKey, generated: false };
  }

  // Priority 2: Config file (llmrouter_api_key)
  const resolved = resolveEnvValue(config.llmrouter_api_key);
  if (resolved) {
    return { key: resolved, generated: false };
  }

  // Priority 3: Auto-generate
  const generated = generateStrongAPIKey();
  if (logger) {
    logger.warn('No API key configured, generated random key');
  }
  return { key: generated, generated: true };
}
```

### 2.4 resolveBackendApiKey 重写

```typescript
// src/proxy/director.ts — 重写

export function resolveBackendApiKey(backend: BackendConfig): string | null {
  if (!backend.require_api_key) {
    return null;
  }

  // 使用 resolveEnvValue 解析 api_key 字段
  const resolved = resolveEnvValue(backend.api_key);
  if (resolved) {
    return resolved;
  }

  // Fallback: for OpenAI-named backends, try OPENAI_API_KEY
  if (backend.name.toLowerCase().includes('openai')) {
    const openaiKey = process.env['OPENAI_API_KEY'];
    if (openaiKey) return openaiKey;
  }

  return null;
}
```

**注意**: `resolveEnvValue` 需要在两个文件中可用。方案选择：
- **推荐**: 将 `resolveEnvValue` 和 `ENV_PLACEHOLDER_RE` 提取到 `src/utils/` 模块，由 `config/index.ts` 和 `proxy/director.ts` 共同导入
- 或者：在 `director.ts` 中内联实现同样的逻辑

### 2.5 CLI 参数清理

```typescript
// src/config/index.ts — 移除 --llmrouter-api-key-env

// Interface 移除 llmrouterApiKeyEnv
interface CliOptions {
  config: string;
  port: number | undefined;
  llmrouterApiKey: string | undefined;
  // llmrouterApiKeyEnv: string | undefined;  ← 删除
  logLevel: string | undefined;
}

function parseCommandLine(): CliOptions {
  const program = new Command();
  program
    .option('--config <path>', 'Config file path', 'config.json')
    .option('--port <number>', 'Listening port')
    .option('--llmrouter-api-key <key>', 'LLM Router API key')
    // .option('--llmrouter-api-key-env <name>', 'API key env var name')  ← 删除
    .option('--log-level <level>', 'Log level (debug/info/warn/error)');

  // ... 解析逻辑中移除 llmrouterApiKeyEnv
}

// loadConfig() 中移除 CLI 覆盖 config.llmrouter_api_key_env 的代码块
```

### 2.6 DEFAULT_CONFIG 更新

```typescript
// src/config/index.ts

const DEFAULT_CONFIG = {
  listening_port: 11411,
  llmrouter_api_key: '',        // ← 替换 llmrouter_api_key_env
  aliases: {},
  backends: [
    {
      name: 'openai',
      base_url: 'https://api.openai.com',
      prefix: 'openai/',
      default: true,
      require_api_key: true,
      // 不再需要 key_env_var，api_key 默认为 ""
    },
  ],
};
```

### 2.7 自动生成 Key 时的提示信息更新

```typescript
// src/config/index.ts — resolveApiKey 中的提示

if (generated) {
  console.log(`
Your LLM-Router endpoint will be exposed publicly.
A strong API key is highly recommended.

You may specify the API key via:
- Config file: set "llmrouter_api_key" in config.json
- Config file with env: set "llmrouter_api_key" to "\${env:YOUR_ENV_VAR}" 
- Environment variable: export LLMROUTER_API_KEY=<key>
  (when config uses "\${env:LLMROUTER_API_KEY}")
- Command line flag: --llmrouter-api-key=your_api_key

Since none was provided, a random key has been generated:
  ${generated}
`);
}
```

## 3. 迁移兼容性

### 3.1 旧 config.json 处理

如果用户仍在使用旧格式（`llmrouter_api_key_env` + `key_env_var`），Zod 验证将在 `strictObject` 模式下拒绝，明确报错字段名不存在。用户需要手动迁移配置。

### 3.2 迁移步骤（用户侧）

1. 全局替换 `"llmrouter_api_key_env"` → `"llmrouter_api_key"`
2. 全局替换 `"key_env_var"` → `"api_key"`
3. 将原环境变量名包裹为 `${env:}` 格式：
   - `"LLMROUTER_API_KEY"` → `"${env:LLMROUTER_API_KEY}"`
   - `"DEEPSEEK_API_KEY"` → `"${env:DEEPSEEK_API_KEY}"`
4. 或直接填写 key 值：
   - `"sk-abc123"` 保持不变（直接值）

## 4. 文件变更清单

| # | 文件 | 操作 | 变更内容 |
|---|------|------|---------|
| 1 | `src/types/index.ts` | 修改 | 两个 Schema 字段替换 |
| 2 | `src/config/index.ts` | 修改 | resolveApiKey 重写、DEFAULT_CONFIG、CLI、提示文案 |
| 3 | `src/proxy/director.ts` | 修改 | resolveBackendApiKey 适配 api_key + ${env:} |
| 4 | `src/utils/` | 新增或修改 | 提取 resolveEnvValue 工具函数 |
| 5 | `specs/001-config-module/spec.md` | 更新 | FR-CFG-003/006/007 |
| 6 | `specs/001-config-module/plan.md` | 更新 | Schema 设计示例、回退策略 |
| 7 | `README.md` | 更新 | config.json 配置说明 |
| 8 | `specs/103-json-use-env/spec.md` | 已完成 | 功能规格 |
| 9 | `specs/103-json-use-env/plan.md` | 本文件 | 技术方案 |
| 10 | `specs/103-json-use-env/tasks.md` | 待生成 | 任务分解 |
| 11 | `specs/103-json-use-env/test-cases.md` | 待生成 | 测试用例 |

## 5. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 旧 config.json 启动失败 | 中 | 中 | Zod 报错信息明确提示字段名变更 |
| `${env:VAR}` 中 VAR 未设置 | 中 | 中 | 北向回退自动生成；南向 warn + null |
| resolveEnvValue 跨文件共享 | 低 | 低 | 提取到 utils/ 统一导入 |
| CLI --llmrouter-api-key-env 移除影响现有脚本 | 低 | 高 | 检查 .env.example 和文档中是否引用此参数 |
