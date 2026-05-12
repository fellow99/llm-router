# 日志模块 (005) 功能规格

> 模块路径: `src/logger/`
> 生成时间: 2026-05-11

## 概述

日志模块负责初始化和管理结构化日志器，提供统一的日志接口，支持日志级别配置和敏感信息脱敏。

## 功能需求

### FR-LOG-001: 结构化日志初始化

- 使用 Winston 创建结构化 JSON 日志器
- 支持可配置日志级别（debug/info/warn/error/trace）
- 日志级别通过命令行参数 `--log-level` 或环境变量 `LOG_LEVEL` 配置
- 默认日志级别: `warn`

### FR-LOG-002: JSON 格式输出

- 所有日志输出为结构化 JSON 格式
- 包含时间戳、日志级别、消息内容
- 支持自定义字段（method, path, statusCode, duration 等）

### FR-LOG-003: 子日志器

- 支持创建子日志器（child logger），携带默认上下文字段
- 代理模块、处理模块等可创建子日志器，附加模块名等默认字段

### FR-LOG-004: Authorization 头脱敏

- 日志中 Authorization 头必须脱敏显示
- 脱敏格式：仅显示前 10 字符 + `...` + 后 4 字符
- 示例：`Bearer rsk_1234567...cdef`

### FR-LOG-005: 调试日志

- debug 级别记录完整的请求/响应详情
- 包括请求方法、URL、请求头、请求体
- 包括响应状态码、响应头、响应体摘要

## 关键函数

### `createLogger(options: LoggerOptions): Logger`

创建 Winston 日志器实例，配置日志级别和传输方式。

### `createChildLogger(parent: Logger, defaultFields: object): Logger`

创建子日志器，携带默认上下文字段。

## 与 Go 版本对照

| Go 版本 | TypeScript 版本 | 说明 |
|---------|----------------|------|
| `logging.NewLogger()` | `createLogger()` | 日志器工厂 |
| `zap.Logger` | `winston.Logger` | 结构化日志 |
| `zap.Sugar()` | Winston 默认接口 | 日志记录方式 |
| `zap.AtomicLevel` | Winston levels | 动态日志级别 |