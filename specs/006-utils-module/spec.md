# 工具模块 (006) 功能规格

> 模块路径: `src/utils/`
> 生成时间: 2026-05-11

## 概述

工具模块提供无状态的通用工具函数，包括日志脱敏、API 密钥生成、请求体处理、流式响应处理和响应录制。

## 功能需求

### FR-UTL-001: Authorization 头脱敏

- 函数：`redactAuthorization(authHeader: string | undefined): string`
- 输入：完整的 Authorization 头值
- 输出：脱敏后的字符串
- 规则：仅显示前 10 字符 + `...` + 后 4 字符
- 示例：`Bearer rsk_1234567890abcdef` → `Bearer rsk...cdef`
- 无 Authorization 头时返回 `"(none)"`

### FR-UTL-002: API 密钥生成

- 函数：`generateStrongAPIKey(): string`
- 使用 `crypto.randomBytes` 生成密码学安全的随机密钥
- 密钥格式：`rsk_` + 48 个随机字符（大小写字母 + 数字）
- 总长度：52 字符
- 生成的密钥必须具有唯一性和不可预测性

### FR-UTL-003: 请求体处理

- 函数：`drainBody(stream: Readable): Promise<Buffer>`
- 从可读流中读取完整请求体
- 返回 Buffer 对象
- 处理流错误和超时

### FR-UTL-004: 流式响应处理

- 检测 SSE 流式响应（`Content-Type: text/event-stream`）
- 流式响应限制最大录制大小为 1MB
- 超过限制时截断并标记
- SSE 事件尝试重新组装为可读格式

### FR-UTL-005: 响应录制

- 函数：`recordResponse(proxyRes: IncomingMessage): Promise<RecordedResponse>`
- 录制完整的 HTTP 响应以支持日志记录
- 非流式响应：完整录制
- 流式响应：限制 1MB，截断时标记 `"[TRUNCATED]"`
- 返回录制结果包含状态码、响应头、响应体

## 关键导出

| 函数 | 签名 | 说明 |
|------|------|------|
| `redactAuthorization` | `(auth?: string) => string` | Authorization 头脱敏 |
| `generateStrongAPIKey` | `() => string` | 生成随机 API 密钥 |
| `drainBody` | `(stream: Readable) => Promise<Buffer>` | 读取完整请求体 |
| `recordResponse` | `(res: IncomingMessage) => Promise<RecordedResponse>` | 录制响应 |

## 与 Go 版本对照

| Go 版本 | TypeScript 版本 | 说明 |
|---------|----------------|------|
| `utils.RedactAuthorization()` | `redactAuthorization()` | 脱敏函数 |
| `utils.GenerateStrongAPIKey()` | `generateStrongAPIKey()` | 密钥生成 |
| `utils.DrainBody()` | `drainBody()` | 请求体读取 |
| `utils.DrainAndCapture()` | `drainAndCapture()` | 读取并捕获 |
| `utils.ResponseRecorder` | `ResponseRecorder` class | 响应录制 |
| `utils.LogRequestResponse()` | `logRequestResponse()` | 请求/响应日志 |
| `crypto/rand` | `crypto.randomBytes` | 密码学安全随机 |