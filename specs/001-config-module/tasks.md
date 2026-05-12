# 001 配置模块 — 开发任务

> 依赖: 004-model（Zod Schema）, 006-utils（generateStrongAPIKey）, 005-logging（createLogger）
> 源码路径: `src/config/index.ts`, `src/config/schema.ts`

## Phase 1: Schema 与依赖

- [ ] T001-01: 安装配置相关依赖
  - 输出: `npm install commander`；确认 dotenv, yaml, jsonc-parser, zod 已在 package.json
  - 验收: `package.json` 包含 commander, dotenv, yaml, jsonc-parser, zod

- [ ] T001-02: 创建 `src/config/schema.ts`，从 types 导入并扩展
  - 输入: 001-config-module/plan.md §3
  - 输出: 导入 ConfigSchema/BackendConfigSchema，添加运行时扩展接口 RuntimeConfig
  - 验收: schema.ts 导出 ConfigSchema, BackendConfigSchema, RuntimeConfig 类型
  - 文件: `src/config/schema.ts`

## Phase 2: 配置文件加载

- [ ] T001-03: 实现多格式配置文件加载 `loadConfigFile(path: string): unknown`
  - 输入: 001-config-module/spec.md FR-CFG-001
  - 输出: 函数根据文件扩展名选择解析器（.json→jsonc-parser, .yaml/.yml→yaml.parse）；文件不存在返回 null
  - 验收: JSON/YAML/JSONC 文件均可正确解析；文件不存在返回 null 不报错
  - 文件: `src/config/index.ts`

- [ ] T001-04: 实现 Zod 验证 `validateConfig(raw: unknown): Config`
  - 输入: 001-config-module/spec.md FR-CFG-004
  - 输出: 使用 ConfigSchema.parse() 验证原始数据，验证失败时使用 formatZodError 格式化错误并 exit(1)
  - 验收: 有效配置通过验证返回类型安全对象；无效配置输出详细错误并退出
  - 文件: `src/config/index.ts`

## Phase 3: 参数与优先级

- [ ] T001-05: 实现命令行参数解析
  - 输入: 001-config-module/spec.md FR-CFG-003
  - 输出: 使用 commander 定义 --config, --port, --llmrouter-api-key, --llmrouter-api-key-env, --log-level 参数
  - 验收: 所有参数可解析，提供默认值
  - 文件: `src/config/index.ts`

- [ ] T001-06: 实现配置优先级合并 `mergeConfig(config, cliOverrides, envVars)`
  - 输入: 001-config-module/spec.md FR-CFG-005
  - 输出: 合并配置文件、命令行参数、环境变量的值，优先级: CLI > env > .env > config > defaults
  - 验收: 命令行参数覆盖环境变量，环境变量覆盖配置文件值
  - 文件: `src/config/index.ts`

## Phase 4: API 密钥与完整加载

- [ ] T001-07: 实现 `loadConfig(): RuntimeConfig` 完整加载流程
  - 输入: 001-config-module/spec.md FR-CFG-006/007
  - 输出: 整合所有步骤：(1) 解析 CLI (2) 加载 .env (3) 加载配置文件 (4) Zod 验证 (5) 合并优先级 (6) API 密钥三级回退 (7) 注入 logger
  - 验收: 完整流程可端到端执行；API 密钥按优先级获取；无配置文件时使用默认值
  - 文件: `src/config/index.ts`