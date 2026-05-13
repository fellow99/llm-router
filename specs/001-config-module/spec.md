# 配置模块 (001) 功能规格

> 模块路径: `src/config/`
> 生成时间: 2026-05-11

## 概述

配置模块负责加载和管理应用程序的所有配置，支持 JSON、JSONC 和 YAML 格式的配置文件，环境变量加载，命令行参数覆盖，以及 Zod Schema 运行时验证。

## 功能需求

### FR-CFG-001: 多格式配置文件加载

- 支持从 JSON 文件加载配置（支持 JSONC 注释）
- 支持从 YAML 文件加载配置
- 根据文件扩展名自动选择解析器（`.json` → JSONC, `.yaml`/`.yml` → YAML）
- 配置文件路径通过命令行参数 `--config` 指定，默认 `config.json`

### FR-CFG-002: 环境变量加载

- 使用 dotenv 加载 `.env` 文件中的环境变量
- 环境变量优先级高于配置文件

### FR-CFG-003: 命令行参数

- 支持 `--config <path>` 配置文件路径
- 支持 `--port <number>` 监听端口
- 支持 `--llmrouter-api-key <key>` 直接指定 API 密钥
- 支持 `--log-level <level>` 日志级别
- 命令行参数优先级最高

### FR-CFG-004: Zod Schema 验证

- 所有配置字段必须通过 Zod Schema 验证
- 验证失败时输出详细的错误信息（包含字段名和错误原因）
- 验证失败时进程退出码为 1
- 默认值通过 Zod `.default()` 定义

### FR-CFG-005: 配置优先级链

配置值的优先级从高到低：
1. 命令行参数
2. 环境变量
3. .env 文件
4. 配置文件
5. Zod Schema 默认值

### FR-CFG-006: API 密钥回退链

LLM-Router 自身 API 密钥的获取优先级：
1. 命令行参数 `--llmrouter-api-key`
2. 配置文件 `llmrouter_api_key` 字段（支持直接值或 `${env:VAR_NAME}` 语法）
3. 自动生成 `rsk_` 前缀密钥（48 个随机字符）

### FR-CFG-007: 默认配置

- 当配置文件不存在时使用硬编码默认配置
- 默认监听端口: 11411
- 默认 API 密钥字段: `llmrouter_api_key`（空字符串）
- 默认日志级别: `warn`

### FR-CFG-008: 环境变量插值语法

- 配置文件中字符串字段支持 `${env:VAR_NAME}` 语法，在运行时被替换为对应环境变量的值
- 如果环境变量未定义，保留原始字符串不变
- 此语法适用于所有字符串配置字段，包括 `llmrouter_api_key` 和后端 `api_key`
- 不支持嵌套 `${env:${env:OTHER}}` 语法

## 关键函数

### `loadConfig(options: LoadConfigOptions): Promise<Config>`

加载并验证配置：解析命令行 → 加载 .env → 读取配置文件 → Zod 验证 → 应用覆盖 → 确定 API 密钥

### `validateConfig(raw: unknown): Config`

使用 Zod Schema 验证原始配置数据。验证失败时抛出 `ZodError`。

## 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| 配置文件不存在 | 使用默认配置继续运行 |
| 配置文件格式错误 | 输出解析错误信息，进程退出 |
| Zod 验证失败 | 输出详细验证错误，进程退出 |
| API 密钥获取失败 | 自动生成随机密钥并打印 |

## 与 Go 版本对照

| Go 版本 | TypeScript 版本 | 说明 |
|---------|----------------|------|
| `config.LoadConfig()` | `loadConfig()` | 功能对等 |
| `flag.Parse()` | commander | CLI 参数解析 |
| `json.Unmarshal()` | jsonc-parser / yaml | 多格式支持 |
| 无 | Zod Schema 验证 | 新增：运行时类型安全 |
| `godotenv.Load()` | dotenv.config() | .env 加载 |