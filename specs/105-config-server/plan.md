# 在 config.json 中配置 server 节点 (105) 技术方案

> 需求编号: 105-config-server
> 生成时间: 2026-05-13

## 1. 技术架构

### 1.1 变更范围

```
src/
├── types/index.ts          # [修改] 新增 ServerConfigSchema / ServerConfig，移除 Config 根级字段
├── config/index.ts         # [修改] loadConfig, CLI parser, 新增 resolveServerHost/Port
├── config/schema.ts        # [不变] re-export from types
├── app.ts                  # [修改] config.listening_port → runtimeConfig.serverPort
└── middleware/auth.ts       # [不变] 使用 RuntimeConfig.llmrouterApiKey

specs/
├── 105-config-server/      # [新增] 本功能的 spec/plan/tasks/test-cases
├── 001-config-module/
│   ├── spec.md             # [更新] 配置模型描述
│   └── plan.md             # [更新] Schema 设计
├── overall-data-model.md   # [更新] Config 实体定义
└── overall-spec.md         # [更新] 相关功能需求引用

docker/
└── config.json              # [修改] 旧 flat 格式 → 新 server 节点格式

README.md                    # [更新] config.json 配置说明
```

### 1.2 核心变更流程

```
┌── 配置加载期 ─────────────────────────────────────────────┐
│                                                            │
│  config.json 加载                                          │
│    │                                                       │
│    ├── Zod 验证 (新 Schema)                                 │
│    │   └── server: { host: string, port: string,            │
│    │                  api_key: string }                     │
│    │                                                       │
│    └── CLI 参数覆盖 (高优先级)                               │
│        ├── --host / -h  → config.server.host = cliHost     │
│        ├── --port / -p  → config.server.port = cliPort     │
│        └── --api-key / -k → cliApiKey (传给 resolveApiKey) │
│                                                            │
├── 值解析期 ──────────────────────────────────────────────┤
│                                                            │
│  resolveServerHost(config.server.host)                     │
│    ├── "" / null / undefined → "127.0.0.1"                 │
│    ├── "true" → "0.0.0.0"                                  │
│    ├── "${env:VAR}" → process.env[VAR] │ fallback "127.0.0.1" │
│    └── 普通字符串 → 直接使用                                 │
│                                                            │
│  resolveServerPort(config.server.port)                     │
│    ├── "" / null / undefined → 11411                       │
│    ├── "${env:VAR}" → Number(process.env[VAR])             │
│    ├── 普通字符串 → Number(value)                           │
│    └── NaN 或 ≤0 → Fatal Error                              │
│                                                            │
│  resolveApiKey(config.server.api_key, cliApiKey)           │
│    ├── 1. cliApiKey → 直接使用                              │
│    ├── 2. config.server.api_key                            │
│    │     ├── "${env:VAR}" → process.env[VAR]               │
│    │     ├── 非空直接值 → 直接使用                           │
│    │     └── 空 → 跳过                                      │
│    └── 3. 自动生成 rsk_ 密钥 (generateStrongAPIKey)         │
│                                                            │
├── RuntimeConfig 组装 ────────────────────────────────────┤
│                                                            │
│  RuntimeConfig = {                                         │
│    ...config,            // server, aliases, backends      │
│    serverHost: string,   // "127.0.0.1"                    │
│    serverPort: number,   // 11411                          │
│    llmrouterApiKey,                                        │
│    useGeneratedKey,                                        │
│    logger                                                 │
│  }                                                         │
│                                                            │
├── 启动日志 ──────────────────────────────────────────────┤
│                                                            │
│  1. logger.info("Server listening on %s:%s", host, port)  │
│  2. 脱敏 api_key 后打印                                    │
│  3. 解析所有 ${env:} 占位符 → 脱敏 → JSON 打印完整配置       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 2. 详细设计

### 2.1 Zod Schema 变更

```typescript
// 新增 ServerConfigSchema
export const ServerConfigSchema = z.object({
  host: z.string().default(''),
  port: z.string().default(''),
  api_key: z.string().default(''),
});

// 更新 ConfigSchema
export const ConfigSchema = z.object({
  server: ServerConfigSchema,              // [新增]
  aliases: z.record(z.string(), AliasTargetSchema).default({}),  // [不变]
  backends: z.array(BackendConfigSchema).min(1, ...),             // [不变]
  // [移除] listening_port, llmrouter_api_key
});

// 更新 RuntimeConfig
export interface RuntimeConfig extends Config {
  serverHost: string;        // [新增] 解析后的 host
  serverPort: number;         // [新增] 解析后的 port
  llmrouterApiKey: string;   // [不变]
  useGeneratedKey: boolean;  // [不变]
  logger: Logger;            // [不变]
}
```

### 2.2 resolveServerHost 函数

```typescript
function resolveServerHost(rawHost: string | undefined | null): string {
  // 1. 空值 → 默认 127.0.0.1
  if (!rawHost) return '127.0.0.1';

  // 2. "true" → 0.0.0.0
  if (rawHost === 'true') return '0.0.0.0';

  // 3. ${env:VAR} → 读取环境变量
  if (ENV_PLACEHOLDER_RE.test(rawHost)) {
    const resolved = resolveEnvValue(rawHost);
    if (resolved) return resolved;
    logger.warn('Environment variable in server.host not found, using 127.0.0.1');
    return '127.0.0.1';
  }

  // 4. 普通字符串
  return rawHost;
}
```

### 2.3 resolveServerPort 函数

```typescript
function resolveServerPort(rawPort: string | undefined | null): number {
  let portStr: string | undefined;

  // 1. 空值 → 默认 11411
  if (!rawPort) return 11411;

  // 2. ${env:VAR} → 读取环境变量
  if (ENV_PLACEHOLDER_RE.test(rawPort)) {
    portStr = resolveEnvValue(rawPort);
    if (!portStr) {
      throw new ConfigError(
        `Environment variable for server.port not found: ${rawPort}`
      );
    }
  } else {
    portStr = rawPort;
  }

  // 3. 转为数字
  const port = Number(portStr);
  if (!Number.isInteger(port) || port <= 0) {
    throw new ConfigError(
      `Invalid server port: "${portStr}". Port must be a positive integer.`
    );
  }

  return port;
}
```

### 2.4 resolveApiKey 适配

与现有逻辑基本一致，仅将 `config.llmrouter_api_key` 改为 `config.server.api_key`：

```typescript
async function resolveApiKey(
  config: Config,
  cliApiKey?: string
): Promise<{ key: string; generated: boolean }> {
  // 1. CLI --api-key 优先
  if (cliApiKey) return { key: cliApiKey, generated: false };

  // 2. config.server.api_key
  const raw = config.server.api_key;
  if (raw) {
    if (ENV_PLACEHOLDER_RE.test(raw)) {
      const envVal = resolveEnvValue(raw);
      if (envVal) return { key: envVal, generated: false };
      logger.warn('Environment variable in server.api_key not found');
    } else {
      return { key: raw, generated: false };
    }
  }

  // 3. 自动生成
  const generated = generateStrongAPIKey();
  logger.info('Auto-generated API key: %s', generated);
  return { key: generated, generated: true };
}
```

### 2.5 CLI 参数更新

Commander 配置变更：

```typescript
program
  .option('-c, --config <path>', 'Path to config file')
  .option('-h, --host <ip>', 'Server listen host (overrides config)')
  .option('-p, --port <port>', 'Server listen port (overrides config)')
  .option('-k, --api-key <key>', 'Northbound API key (overrides config)');
  // [移除] --llmrouter-api-key
```

### 2.6 启动日志

```typescript
// 在 app.ts 或 config/index.ts 启动阶段：

// 1. 打印服务信息
logger.info('Server listening on %s:%d', runtime.serverHost, runtime.serverPort);

// 2. 打印 API Key
const keyPreview = runtime.useGeneratedKey
  ? runtime.llmrouterApiKey                // 自动生成的，打印完整
  : runtime.llmrouterApiKey.slice(0, 4) + '****';  // 手动配置的，脱敏
logger.info('API Key: %s', keyPreview);

// 3. 打印完整配置 (解析所有 ${env:} + 脱敏)
const resolvedConfig = {
  server: {
    host: runtime.serverHost,
    port: runtime.serverPort,
    api_key: keyPreview,
  },
  aliases: config.aliases,
  backends: config.backends.map(b => ({
    ...b,
    api_key: b.api_key ? '[REDACTED]' : '',
  })),
};
logger.info('Resolved config: %j', resolvedConfig);
```

### 2.7 docker/config.json 更新

```json
{
  "server": {
    "host": "",
    "port": "11411",
    "api_key": "${env:LLMROUTER_API_KEY}"
  },
  "aliases": {},
  "backends": []
}
```

### 2.8 向后兼容检测

在 `loadConfig()` 中，Zod 验证后检测旧格式字段：

```typescript
// 检测旧格式 config.json
const rawConfig = JSON.parse(fileContent);
if (rawConfig.listening_port !== undefined || rawConfig.llmrouter_api_key !== undefined) {
  throw new ConfigError(
    'Detected deprecated flat config format. ' +
    'Please migrate to the new "server" node format. ' +
    'See the migration guide or test.config.json for reference.'
  );
}
```

## 3. 实施步骤

| 步骤 | 文件 | 操作 | 依赖 |
|------|------|------|------|
| 1 | `src/types/index.ts` | 新增 `ServerConfigSchema`, 更新 `ConfigSchema` (移除旧字段), 更新 `RuntimeConfig` | - |
| 2 | `src/config/index.ts` | 新增 `resolveServerHost()`, `resolveServerPort()`, 适配 `resolveApiKey()`, 更新 CLI parser, 更新 `loadConfig()` 流程, 新增启动日志 | 1 |
| 3 | `src/app.ts` | `config.listening_port` → `runtime.serverPort` | 2 |
| 4 | `docker/config.json` | 更新为新格式 | - |
| 5 | `specs/` 文档 | 更新 001-config-module, overall-data-model, overall-spec | 2 |
| 6 | `README.md` | 更新配置示例 | 2 |

## 4. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 旧 `config.json` 用户升级后启动失败 | 服务不可用 | 明确的错误提示 + docker/config.json 示例 |
| `--llmrouter-api-key` 参数被移除 | CLI 脚本兼容性 | 可以保留为 alias 或警告后忽略 |
| `server.host="true"` 二义性 | 用户意图混淆 | 明确文档说明 `"true"` 作为特殊值 |
