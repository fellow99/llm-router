# 在 config.json 中配置 server 节点 (105) 功能规格

> 需求编号: 105-config-server
> 模块路径: `src/config/`, `src/types/`, `src/app.ts`
> 生成时间: 2026-05-13

## 概述

将 `config.json` 中散落在根节点的服务配置字段（`listening_port`、`llmrouter_api_key`）整合为 `server` 节点，统一管理服务监听 IP、端口和北向 API KEY。同时扩展 CLI 参数支持 `--host` 和 `--api-key`（重命名 `--llmrouter-api-key`），并完善启动日志。

## 功能需求

### FR-SRV-001: server 节点定义

- **新增** `server` 节点，包含三个字段：`host`、`port`、`api_key`
- `server.host` — 服务监听 IP（字符串），支持以下值：
  - 默认不填写、空字符串 `""`、`null`、`undefined` → 内部设为 `"127.0.0.1"`
  - `"true"` → 内部设为 `"0.0.0.0"`
  - `"${env:LLMROUTER_SERVER_HOST}"` → 读取环境变量 `LLMROUTER_SERVER_HOST` 的值
  - 普通字符串 → 直接作为监听 IP 使用
- `server.port` — 服务监听端口（字符串），支持以下值：
  - 默认不填写、空字符串 `""`、`null`、`undefined` → 内部设为数字 `11411`
  - `"${env:LLMROUTER_SERVER_PORT}"` → 读取环境变量 `LLMROUTER_SERVER_PORT` 的值并转为数字（转换失败则报错退出）
  - 普通字符串 → 转为数字使用（转换失败则报错退出）
- `server.api_key` — 北向对外服务的 API KEY（字符串），支持以下值：
  - 直接填写具体的 key 值 → 直接使用
  - `"${env:LLMROUTER_API_KEY}"` → 读取环境变量 `LLMROUTER_API_KEY` 的值
  - 不填写 / 空字符串 → 动态生成（沿用现有 `generateStrongAPIKey()` 逻辑）
- **移除** 根节点的 `listening_port` 和 `llmrouter_api_key` 字段
- **保留** 根节点的 `aliases` 和 `backends` 字段不变

### FR-SRV-002: Zod Schema 更新

- `ConfigSchema` 变更：
  - **移除** `listening_port: z.number().int().positive().default(11411)`
  - **移除** `llmrouter_api_key: z.string().default('')`
  - **新增** `server: ServerConfigSchema`
- 新建 `ServerConfigSchema`：
  ```typescript
  const ServerConfigSchema = z.object({
    host: z.string().default(''),
    port: z.string().default(''),
    api_key: z.string().default(''),
  });
  ```
- `RuntimeConfig` 接口保持 `llmrouterApiKey: string` 字段不变（值为解析后的实际 key）
- 新增 `RuntimeConfig.serverHost: string` 和 `RuntimeConfig.serverPort: number` 字段（解析后的实际值）

### FR-SRV-003: 移除 flat 字段

- **移除** Config 接口中的 `listening_port: number` 字段
- **移除** Config 接口中的 `llmrouter_api_key: string` 字段
- `test.config.json` 已经是新格式，无需修改
- `docker/config.json` 需更新为新格式：
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

### FR-SRV-004: server.host 解析逻辑

在 `src/config/index.ts` 中新增 `resolveServerHost()` 函数：

1. 若 `server.host` 为空字符串 `""`、`null`、`undefined` → 返回 `"127.0.0.1"`
2. 若 `server.host === "true"` → 返回 `"0.0.0.0"`
3. 若匹配 `${env:VAR_NAME}` 格式 → 通过 `resolveEnvValue()` 读取环境变量值
   - 若环境变量存在 → 返回其值
   - 若环境变量不存在 → 返回 `"127.0.0.1"` 并记录 warn 日志
4. 其他普通字符串 → 直接作为 host 值返回

### FR-SRV-005: server.port 解析逻辑

在 `src/config/index.ts` 中新增 `resolveServerPort()` 函数：

1. 若 `server.port` 为空字符串 `""`、`null`、`undefined` → 返回 `11411`
2. 若匹配 `${env:VAR_NAME}` 格式 → 通过 `resolveEnvValue()` 读取环境变量值，转为数字
3. 普通字符串 → 转为数字
4. 数字转换失败（`NaN` 或非正整数）→ 报错退出：
   ```
   Fatal: Invalid server port: "<value>". Port must be a positive integer.
   ```

### FR-SRV-006: server.api_key 解析逻辑

沿用并适配现有 `resolveApiKey()` 函数（当前位于 `src/config/index.ts`）：

1. CLI `--api-key` 优先（最高优先级）
2. 检查 `config.server.api_key`：
   - 如果匹配 `${env:VAR}` 格式 → 读取 `process.env[VAR]`
   - 如果环境变量存在 → 使用环境变量值
   - 如果环境变量不存在 → 记录 warn 日志
3. 如果 `config.server.api_key` 为直接值（非 `${env:}` 格式且非空）→ 直接使用
4. 如果以上都未得到有效 key → 调用 `generateStrongAPIKey()` 自动生成

### FR-SRV-007: CLI 参数更新

在 `src/config/index.ts` 的 commander 配置中：

- **保留** `--config` / `-c` — 配置文件路径（已有，来自 spec 001）
- **新增** `--host` / `-h` — 服务监听 IP，优先级高于 `config.json` 中的 `server.host`
- **保留** `--port` / `-p` — 服务监听端口，优先级高于 `config.json` 中的 `server.port`（已有，来自 spec 001）
- **重命名** `--llmrouter-api-key` → `--api-key` / `-k` — 北向 API KEY，优先级高于 `config.json` 中的 `server.api_key`
- CLI 参数的优先级：CLI `--host` > `server.host`；CLI `--port` > `server.port`；CLI `--api-key` > `server.api_key`

### FR-SRV-008: 启动日志

在 `src/config/index.ts` 的 `loadConfig()` 函数末尾或 `src/app.ts` 启动时：

1. **打印服务信息**：
   ```
   [Config] Server listening on <host>:<port>
   [Config] API Key: <api_key_truncated>
   ```
   - `api_key` 需要脱敏处理：仅显示前 4 个字符 + `****`（如 `rsk_****`），自动生成的 key 打印完整值
2. **打印完整配置**：
   - 先将配置中所有 `${env:VAR_NAME}` 占位符解析为真实环境变量值
   - 对所有 API KEY 字段进行脱敏处理
   - 使用 `logger.info()` 以 JSON 格式打印

### FR-SRV-009: 代码引用更新

以下文件中引用了 `config.listening_port` 或 `config.llmrouter_api_key` 或 `config.llmrouterApiKey`，需全部更新：

| 文件 | 当前引用 | 变更 |
|------|---------|------|
| `src/app.ts` | `config.listening_port` | → `runtimeConfig.serverPort` |
| `src/config/index.ts` | `config.llmrouter_api_key` | → `config.server.api_key` |
| `src/config/index.ts` | `config.listening_port` | → 新增解析后通过 `RuntimeConfig` 暴露 |
| `src/middleware/auth.ts` | `config.llmrouterApiKey` | 不变（通过 RuntimeConfig 传递） |

### FR-SRV-010: 文档更新

- **README.md**：更新 `config.json` 配置示例，展示新的 `server` 节点结构
- **specs/001-config-module/spec.md**：更新配置模型描述，反映 `server` 节点变更
- **specs/overall-data-model.md**：更新 Config 实体定义
- **specs/overall-spec.md**：更新相关功能需求引用

## 数据模型变更

### 变更前 (Config)

```typescript
interface Config {
  listening_port: number;
  llmrouter_api_key: string;
  aliases: Record<string, AliasTarget>;
  backends: BackendConfig[];
}
```

### 变更后 (Config)

```typescript
interface ServerConfig {
  host: string;   // 原始字符串，含可能的 ${env:} 占位符
  port: string;   // 原始字符串，含可能的 ${env:} 占位符
  api_key: string; // 原始字符串，含可能的 ${env:} 占位符或直值
}

interface Config {
  server: ServerConfig;
  aliases: Record<string, AliasTarget>;
  backends: BackendConfig[];
}
```

### RuntimeConfig 扩展

```typescript
interface RuntimeConfig extends Config {
  serverHost: string;       // 解析后的实际 IP（如 "127.0.0.1"）
  serverPort: number;        // 解析后的实际端口（如 11411）
  llmrouterApiKey: string;   // 不变：解析后的实际 API Key
  useGeneratedKey: boolean;  // 不变
  logger: Logger;            // 不变
}
```

## 依赖关系

- **前置依赖**: 103-json-use-env（`${env:VAR}` 解析已实现），001-config-module（基础配置加载框架）
- **影响模块**: `src/config/index.ts`, `src/types/index.ts`, `src/app.ts`, `src/middleware/auth.ts`, `docker/config.json`
- **不影响**: `src/proxy/`, `src/handler/`, `src/routes/`, `src/logger/`, `src/utils/env.ts`, `src/utils/keygen.ts`

## 验收标准

1. `config.json` 支持 `server` 节点，含 `host`、`port`、`api_key` 三个字段
2. 不配置 `server.host` 时默认监听 `127.0.0.1`
3. `server.host: "true"` 时监听 `0.0.0.0`
4. `server.host: "${env:LLMROUTER_SERVER_HOST}"` 时读取环境变量
5. 不配置 `server.port` 时默认使用 `11411`
6. `server.port` 为非数字字符串时启动报错退出
7. `server.api_key` 支持直接值、`${env:}` 引用和自动生成三种方式
8. CLI `--host` / `-h` 参数可覆盖配置
9. CLI `--api-key` / `-k` 参数替代原 `--llmrouter-api-key`
10. `--llmrouter-api-key` 不再支持（若传入应报错或警告）
11. CLI 参数优先级高于 `config.json`
12. 启动时日志打印服务 host、port、脱敏后的 api_key
13. 启动时日志打印解析后的完整配置（所有 `${env:}` 已替换为真实值，API KEY 脱敏）
14. `docker/config.json` 更新为新格式
15. `README.md` 更新配置示例
16. 相关 specs 文档更新引用
17. 向后兼容：旧格式 `config.json`（含 `listening_port`）启动时明确报错提示新格式
