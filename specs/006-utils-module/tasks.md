# 006 工具模块 — 开发任务

> 依赖: 004-model（类型定义）
> 源码路径: `src/utils/index.ts`

## Phase 1: 核心工具函数

- [ ] T006-01: 实现 `generateStrongAPIKey()`
  - 输入: 006-utils-module/spec.md FR-UTL-001/002
  - 输出: 函数返回 `rsk_` + 48 字符随机密钥（大小写字母+数字），使用 `crypto.randomBytes`
  - 验收: 密钥格式 `rsk_` + `[A-Za-z0-9]{48}`；连续调用 10 次结果均不相同
  - 文件: `src/utils/keygen.ts`

- [ ] T006-02: 实现 `redactAuthorization()`
  - 输入: 006-utils-module/spec.md FR-UTL-003
  - 输出: 函数接收 Authorization 头字符串，返回脱敏版本（前 10 + `...` + 后 4 字符）
  - 验收: `"Bearer sk-1234567890abcdef"` → `"Bearer sk-1...cdef"`；空字符串/短字符串安全处理
  - 文件: `src/utils/redact.ts`

- [ ] T006-03: 实现 `drainBody()`
  - 输入: Go 版本 `utils.DrainBody` 逻辑
  - 输出: 函数读取 Node.js Readable 流并返回 Buffer，支持最大大小限制
  - 验收: 超过限制时截断并标记；正常流完整读取
  - 文件: `src/utils/stream.ts`

- [ ] T006-04: 实现响应录制功能
  - 输入: Go 版本 `utils.ResponseRecorder` 逻辑
  - 输出: 函数包装 Express Response 对象，录制响应体用于日志；流式响应限制 1MB
  - 验收: 非流式响应完整录制；流式响应超 1MB 截断标记
  - 文件: `src/utils/stream.ts`

- [ ] T006-05: 实现 SSE 流式内容重组
  - 输入: Go 版本 SSE 重组逻辑
  - 输出: 函数将 SSE `data:` 行重新组装为可读格式用于日志输出
  - 验收: 多行 `data: {...}` 重组为单行可读 JSON
  - 文件: `src/utils/stream.ts`

## Phase 2: 统一导出

- [ ] T006-06: 创建 `src/utils/index.ts` 统一导出
  - 输出: 从 `./keygen`, `./redact`, `./stream` 重新导出所有公共函数
  - 验收: 其他模块可 `import { generateStrongAPIKey, redactAuthorization, drainBody } from '../utils'`
  - 文件: `src/utils/index.ts`