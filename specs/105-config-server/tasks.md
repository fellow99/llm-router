# 在 config.json 中配置 server 节点 (105) 任务分解

> 需求编号: 105-config-server
> 基于: spec.md, plan.md
> 生成时间: 2026-05-13

## 任务列表

### TASK-001: 更新 Zod Schema — 新增 ServerConfig，更新 Config 类型

**优先级**: P0 (阻塞后续所有任务)
**依赖**: 无

- `src/types/index.ts`：
  - 新增 `ServerConfigSchema`：`{ host: z.string().default(''), port: z.string().default(''), api_key: z.string().default('') }`
  - 导出 `ServerConfig` 类型：`z.infer<typeof ServerConfigSchema>`
  - 更新 `ConfigSchema`：新增 `server: ServerConfigSchema`，移除 `listening_port` 和 `llmrouter_api_key`
  - 更新 `RuntimeConfig` 接口：新增 `serverHost: string` 和 `serverPort: number`

**验证**: TypeScript 编译通过 (`npx tsc --noEmit`)，类型检查无错误

---

### TASK-002: 实现 resolveServerHost 和 resolveServerPort 函数

**优先级**: P0
**依赖**: TASK-001

- `src/config/index.ts`：
  - 新增 `resolveServerHost(raw: string | undefined | null): string` 函数
    - 空值 → `"127.0.0.1"`
    - `"true"` → `"0.0.0.0"`
    - `${env:VAR}` → `resolveEnvValue()` 解析，失败回退 `"127.0.0.1"`
    - 普通字符串 → 直接返回
  - 新增 `resolveServerPort(raw: string | undefined | null): number` 函数
    - 空值 → `11411`
    - `${env:VAR}` → 解析后转数字
    - 普通字符串 → 转数字
    - 非数字或无效端口 → 抛出 `ConfigError("Invalid server port: ...")`

**验证**: 编译通过；手动测试各场景（空值、env var、无效值报错）

---

### TASK-003: 适配 resolveApiKey 函数

**优先级**: P0
**依赖**: TASK-001

- `src/config/index.ts`：
  - 将 `config.llmrouter_api_key` 引用改为 `config.server.api_key`
  - 优先级逻辑不变：CLI `--api-key` > `server.api_key` (`${env:}` / 直值) > 自动生成
  - 保留自动生成时的提示信息（调整字段名引用）

**验证**: 编译通过；逻辑路径与原有三级回退一致

---

### TASK-004: 更新 CLI 参数解析

**优先级**: P0
**依赖**: TASK-001

- `src/config/index.ts` 的 commander 配置：
  - 保留 `--config`/`-c`
  - **新增** `--host`/`-h`：服务监听 IP，存入 `cliHost` 变量
  - 保留 `--port`/`-p`（已存在）
  - **重命名**：`--llmrouter-api-key` → `--api-key`/`-k`
  - 移除 `--llmrouter-api-key` 参数
  - CLI 参数优先级：`--host` > `server.host`；`--port` > `server.port`；`--api-key` > `server.api_key`

**验证**: 编译通过；`--help` 输出正确参数列表

---

### TASK-005: 更新 loadConfig 主流程

**优先级**: P0
**依赖**: TASK-002, TASK-003, TASK-004

- `src/config/index.ts` 的 `loadConfig()` 函数：
  - 解析 `config.json` 后检测旧格式（含 `listening_port` 或 `llmrouter_api_key` 根字段）
    - 若检测到旧格式 → 抛出 `ConfigError` 明确提示迁移
  - CLI 参数覆盖 `config.server` 的 host/port/（api_key 在 resolveApiKey 中处理）
  - 调用 `resolveServerHost()` 和 `resolveServerPort()` 得到 `serverHost`、`serverPort`
  - 调用 `resolveApiKey()` 得到 `llmrouterApiKey`、`useGeneratedKey`
  - 组装 `RuntimeConfig`（含 `serverHost`、`serverPort`、原有 `llmrouterApiKey` 等）
  - 新增启动日志：
    1. `logger.info('Server listening on %s:%d', host, port)`
    2. `logger.info('API Key: %s', keyPreview)` — 手动配置的值脱敏，自动生成的值打印完整
    3. 解析配置中所有 `${env:}` 占位符 + 脱敏 backend api_key → JSON 打印

**验证**: 编译通过；启动验证日志输出

---

### TASK-006: 更新 app.ts 引用

**优先级**: P0
**依赖**: TASK-005

- `src/app.ts`：
  - `config.listening_port` → `runtimeConfig.serverPort`
  - `app.listen(runtimeConfig.serverPort, runtimeConfig.serverHost, ...)`
  - `serverHost` 未配置时默认 localhost（已在 resolveServerHost 中处理）

**验证**: 编译通过；服务正常启动监听

---

### TASK-007: 更新 docker/config.json

**优先级**: P1
**依赖**: TASK-001

- `docker/config.json` 更新为新格式：
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

**验证**: 新格式用 Zod Schema 验证通过

---

### TASK-008: 更新 README.md

**优先级**: P1
**依赖**: TASK-006

- `README.md`：
  - 更新 `config.json` 配置示例，展示 `server` 节点
  - 更新 CLI 启动示例，展示 `--host`、`--api-key` 参数
  - 移除 `--llmrouter-api-key` 和 `listening_port` 的引用

**验证**: 文档可读性检查

---

### TASK-009: 更新 specs 文档

**优先级**: P2
**依赖**: TASK-006

- `specs/001-config-module/spec.md`：更新配置模型描述，反映 `server` 节点和字段名变更
- `specs/001-config-module/plan.md`：更新 Schema 设计章节
- `specs/overall-data-model.md`：更新 Config 实体定义和字段表
- `specs/overall-spec.md`：更新相关功能需求引用

**验证**: 文档一致性检查

---

## 任务依赖图

```
TASK-001 (Schema 更新)
  ├── TASK-002 (resolveServerHost/Port)
  │     └── TASK-005 (loadConfig 主流程)
  │           ├── TASK-006 (app.ts)
  │           │     ├── TASK-008 (README.md)
  │           │     └── TASK-009 (specs 文档)
  │           └── TASK-007 (docker/config.json)
  ├── TASK-003 (resolveApiKey)
  │     └── TASK-005
  └── TASK-004 (CLI parser)
        └── TASK-005
```

## 并行机会

- TASK-002, TASK-003, TASK-004 可并行执行（都只依赖 TASK-001）
- TASK-007 可与其他任务并行（仅依赖 TASK-001）
- TASK-008, TASK-009 可并行执行（都只依赖 TASK-006）
