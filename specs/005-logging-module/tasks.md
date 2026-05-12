# 005 日志模块 — 开发任务

> 依赖: 004-model（类型定义）
> 源码路径: `src/logger/index.ts`

## Phase 1: 日志器创建

- [ ] T005-01: 安装 Winston 依赖
  - 输出: `npm install winston` + `npm install -D @types/winston`（如需）
  - 验收: `package.json` 包含 winston 依赖

- [ ] T005-02: 实现 `createLogger(level: string): Logger`
  - 输入: 005-logging-module/spec.md FR-LOG-001/002
  - 输出: 创建 Winston Logger 实例，配置 JSON 格式输出、时间戳、日志级别
  - 验收: 日志输出为 JSON 格式，包含 level, message, timestamp 字段；级别可通过参数控制
  - 文件: `src/logger/index.ts`

- [ ] T005-03: 实现子日志器 `createChildLogger(logger: Logger, context: Record<string, unknown>): Logger`
  - 输入: 005-logging-module/plan.md
  - 输出: 创建带有默认上下文字段的子日志器（如 module 名称、请求 ID 等）
  - 验收: 子日志器输出的每条日志自动包含 context 中的字段
  - 文件: `src/logger/index.ts`

## Phase 2: 日志脱敏

- [ ] T005-04: 实现日志脱敏配置
  - 输入: 005-logging-module/spec.md FR-LOG-003
  - 输出: Winston 格式化器，自动脱敏 `Authorization` 和 `authorization` 字段（前 10 + 后 4 字符）
  - 验收: 日志中 Authorization 字段自动脱敏；其他字段不受影响
  - 文件: `src/logger/index.ts`