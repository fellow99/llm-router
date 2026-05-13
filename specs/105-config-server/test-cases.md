# 在 config.json 中配置 server 节点 (105) 测试用例

> 需求编号: 105-config-server
> 基于: spec.md
> 生成时间: 2026-05-13

## 测试环境

- 项目根目录: `/root/GitHub/fellow99/llm-router`
- 测试配置文件: `test.config.json`（已是新格式）

---

## 后端测试 — 配置加载与解析

### TC-SRV-001: 新格式 config.json 正常加载

**前置条件**: `test.config.json` 使用 `server` 节点格式
**步骤**:
1. 启动服务：`npx ts-node src/app.ts --config test.config.json`
**预期结果**:
- 服务正常启动，无报错
- 日志打印 `Server listening on <host>:<port>` (host/port 根据环境变量或默认值)
- Zod 验证通过，不触发旧格式错误提示

---

### TC-SRV-002: 旧格式 config.json 被拒绝

**前置条件**: 准备一个含旧字段的临时配置
```json
{ "listening_port": 11411, "llmrouter_api_key": "sk-test", "aliases": {}, "backends": [] }
```
**步骤**:
1. 将上述内容保存为 `/tmp/old-config.json`
2. 启动服务：`npx ts-node src/app.ts --config /tmp/old-config.json`
**预期结果**:
- 立即报错退出：
  ```
  ConfigError: Detected deprecated flat config format. Please migrate to the new "server" node format.
  ```
- 进程退出码非 0

---

### TC-SRV-003: server.host 默认值 (空/不配置)

**前置条件**: `server.host` 为空字符串 `""` 或不配置
**步骤**:
1. 确保配置中 `server.host` 为 `""`（test.config.json 用的是 `${env:}` 格式，需要改）
2. 或者不设置 `LLMROUTER_SERVER_HOST` 环境变量
**预期结果**:
- 服务监听 `127.0.0.1`
- 日志显示 `Server listening on 127.0.0.1:<port>`

---

### TC-SRV-004: server.host = "true" → 0.0.0.0

**前置条件**: 修改配置 `server.host: "true"`
**步骤**:
1. 启动服务
**预期结果**:
- 服务监听 `0.0.0.0`
- 日志显示 `Server listening on 0.0.0.0:<port>`

---

### TC-SRV-005: server.host = "${env:LLMROUTER_SERVER_HOST}" 环境变量存在

**前置条件**: 设置环境变量 `LLMROUTER_SERVER_HOST=10.0.0.1`
**步骤**:
1. 启动服务：`LLMROUTER_SERVER_HOST=10.0.0.1 npx ts-node src/app.ts --config test.config.json`
**预期结果**:
- 服务监听 `10.0.0.1`
- 日志显示 `Server listening on 10.0.0.1:<port>`

---

### TC-SRV-006: server.host = "${env:LLMROUTER_SERVER_HOST}" 环境变量不存在

**前置条件**: 确保 `LLMROUTER_SERVER_HOST` 环境变量未设置
**步骤**:
1. 启动服务：`npx ts-node src/app.ts --config test.config.json`
**预期结果**:
- 服务回退监听 `127.0.0.1`
- warn 日志提示环境变量未找到
- 日志显示 `Server listening on 127.0.0.1:<port>`

---

### TC-SRV-007: server.port 默认值 (空/不配置)

**前置条件**: `server.port` 为空字符串 `""` 或不配置
**步骤**:
1. 修改配置 `server.port: ""`
2. 启动服务
**预期结果**:
- 服务监听端口 `11411`

---

### TC-SRV-008: server.port = "3000" (普通字符串)

**前置条件**: 配置 `server.port: "3000"`
**步骤**:
1. 启动服务
**预期结果**:
- 服务监听端口 `3000`
- 日志显示 `Server listening on <host>:3000`

---

### TC-SRV-009: server.port = "${env:LLMROUTER_SERVER_PORT}" 环境变量存在

**前置条件**: 设置环境变量 `LLMROUTER_SERVER_PORT=8080`
**步骤**:
1. 启动服务：`LLMROUTER_SERVER_PORT=8080 npx ts-node src/app.ts --config test.config.json`
**预期结果**:
- 服务监听端口 `8080`

---

### TC-SRV-010: server.port = "abc" (无效值) → 启动报错

**前置条件**: 修改配置 `server.port: "abc"`
**步骤**:
1. 启动服务
**预期结果**:
- 立即报错退出：
  ```
  ConfigError: Invalid server port: "abc". Port must be a positive integer.
  ```

---

### TC-SRV-011: server.port = "0" (无效端口) → 启动报错

**前置条件**: 修改配置 `server.port: "0"`
**步骤**:
1. 启动服务
**预期结果**:
- 立即报错退出：`ConfigError: Invalid server port ...`

---

### TC-SRV-012: server.api_key = "sk-direct-key" (直接值)

**前置条件**: 配置 `server.api_key: "sk-direct-key"`
**步骤**:
1. 启动服务
2. 检查 auth 中间件验证
**预期结果**:
- API Key 为 `sk-direct-key`
- 日志脱敏显示 `API Key: sk-d****`
- 使用 `Bearer sk-direct-key` 发送请求验证通过

---

### TC-SRV-013: server.api_key = "${env:LLMROUTER_API_KEY}" 环境变量存在

**前置条件**: 设置环境变量 `LLMROUTER_API_KEY=env-key-abc123`
**步骤**:
1. 启动服务：`LLMROUTER_API_KEY=env-key-abc123 npx ts-node src/app.ts --config test.config.json`
**预期结果**:
- API Key 为 `env-key-abc123`
- 使用 `Bearer env-key-abc123` 验证通过

---

### TC-SRV-014: server.api_key 空 → 自动生成

**前置条件**: 配置 `server.api_key: ""`，未设置环境变量，未传 CLI 参数
**步骤**:
1. 启动服务
**预期结果**:
- 自动生成 `rsk_` 前缀的 51 字符密钥
- 日志打印完整自动生成的 key
- `useGeneratedKey = true`

---

### TC-SRV-015: CLI --host 覆盖配置

**前置条件**: 配置 `server.host: "127.0.0.1"` 或通过 `${env:}` 设置
**步骤**:
1. 启动服务：`npx ts-node src/app.ts --config test.config.json --host 0.0.0.0`
**预期结果**:
- 服务监听 `0.0.0.0`（CLI 参数优先）
- 配置中的 host 值被忽略

---

### TC-SRV-016: CLI --port 覆盖配置

**前置条件**: 配置 `server.port: "11411"`
**步骤**:
1. 启动服务：`npx ts-node src/app.ts --config test.config.json --port 9000`
**预期结果**:
- 服务监听端口 `9000`（CLI 参数优先）

---

### TC-SRV-017: CLI --api-key 覆盖配置

**前置条件**: 配置 `server.api_key: "${env:LLMROUTER_API_KEY}"` 或直接值
**步骤**:
1. 启动服务：`npx ts-node src/app.ts --config test.config.json --api-key cli-override-key`
**预期结果**:
- API Key 为 `cli-override-key`
- `useGeneratedKey = false`

---

### TC-SRV-018: 启动日志打印服务信息

**前置条件**: 正常启动
**步骤**:
1. 启动服务
**预期结果**:
- 日志包含 `Server listening on <host>:<port>`，host 和 port 为解析后的实际值
- 日志包含 `API Key: <preview>`，手动配置的值脱敏（前 4 字符 + `****`），自动生成的值完整打印

---

### TC-SRV-019: 启动日志打印解析后完整配置

**前置条件**: 正常启动
**步骤**:
1. 启动服务
**预期结果**:
- 日志包含 `Resolved config:` 及 JSON 对象
- 所有 `${env:VAR}` 已替换为实际环境变量值
- `backends[].api_key` 被脱敏（显示为 `[REDACTED]`）
- `server.api_key` 被脱敏

---

### TC-SRV-020: docker/config.json 新格式可用

**前置条件**: `docker/config.json` 已更新为新格式
**步骤**:
1. 启动服务：`npx ts-node src/app.ts --config docker/config.json`
**预期结果**:
- 服务正常启动（使用默认 host `127.0.0.1`，默认 port `11411`）
- API Key 根据 `LLMROUTER_API_KEY` 环境变量或自动生成

---

### TC-SRV-021: README.md 配置示例正确

**前置条件**: README.md 已更新
**步骤**:
1. 阅读 README.md 中的 config.json 配置部分
**预期结果**:
- 展示 `server` 节点结构
- CLI 示例使用 `--host`, `--api-key` 参数
- 不包含旧的 `listening_port`、`llmrouter_api_key`、`--llmrouter-api-key` 引用
