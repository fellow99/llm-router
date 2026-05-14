# 模型禁用 (104) 测试用例

> 需求编号: 104-model-disabled
> 生成时间: 2026-05-13

## 1. 类型与配置测试

### TC-DIS-001: Zod Schema 接受 Backend `disabled`
- **前置条件**: 无
- **步骤**: 使用含 `"disabled": true` 的 backend 配置启动应用
- **预期结果**: `ConfigSchema.safeParse` 通过，`disabled` 字段正确解析为 `true`
- **优先级**: P0

### TC-DIS-002: Zod Schema 默认值为 false
- **前置条件**: 无
- **步骤**: 使用不含 `disabled` 字段的 backend 配置
- **预期结果**: `disabled` 默认为 `false`，行为与之前完全一致
- **优先级**: P0

### TC-DIS-003: Zod Schema 接受 Alias Target `disabled`
- **前置条件**: 无
- **步骤**: 使用含 `"disabled": true` 的加权别名配置
- **预期结果**: `ConfigSchema.safeParse` 通过
- **优先级**: P0

### TC-DIS-004: 配置保留未知字段
- **前置条件**: 配置含 `"disabled": false` 的 backend
- **步骤**: 加载并解析配置
- **预期结果**: `disabled` 为 `false`，后端正常工作
- **优先级**: P1

## 2. Backend disabled 路由测试

### TC-DIS-005: disabled 后端不创建 proxy
- **前置条件**: backends 中配置一个 `disabled: true` 的后端
- **步骤**: 启动服务，检查启动日志
- **预期结果**: 
  - 日志中出现 `"Backend disabled, skipping proxy creation"`
  - 日志中不出现该后端的 `"Proxy initialized"` 记录
- **优先级**: P0

### TC-DIS-006: disabled 后端的前缀无法匹配
- **前置条件**: 后端 `opencode-go/` 标记 `disabled: true`；其他后端正常
- **步骤**: 发送请求 `model: "opencode-go/gpt-4"`
- **预期结果**: 不路由到 `opencode-go` 后端（走 default 或返回 502）
- **优先级**: P0

### TC-DIS-007: disabled 后端不影响其他后端
- **前置条件**: backend A disabled，backend B normal
- **步骤**: 发送请求 `model: "B-prefix/model"`
- **预期结果**: 正常路由到 backend B
- **优先级**: P0

### TC-DIS-008: 默认后端 disabled
- **前置条件**: 唯一的 `default: true` 后端标记 `disabled: true`
- **步骤**: 发送无前缀匹配的请求
- **预期结果**: 返回 502（无 default proxy 可用）或由其他可用后端处理
- **优先级**: P1

### TC-DIS-009: 所有后端 disabled
- **前置条件**: 所有 backends 标记 `disabled: true`
- **步骤**: 发送任意请求
- **预期结果**: 返回 502 `no_backend`
- **优先级**: P2

## 3. Alias Target disabled 路由测试

### TC-DIS-010: disabled 目标不参与加权选择
- **前置条件**: 加权别名含 `a/model (weight: 1)` 和 `b/model (disabled: true, weight: 1)`
- **步骤**: 多次请求该别名
- **预期结果**: 始终选中 `a/model`，`b/model` 从不出现
- **优先级**: P0

### TC-DIS-011: disabled 目标不进入 fallback 列表
- **前置条件**: `a/model (weight: 1)`, `b/model (weight: 1, fallback: true)`, `c/model (disabled: true, fallback: true)`
- **步骤**: 请求别名，主后端返回 502
- **预期结果**: fallback 重试仅尝试 `b/model`，不尝试 `c/model`
- **优先级**: P1

### TC-DIS-012: 所有目标都 disabled
- **前置条件**: 别名所有目标 `disabled: true`
- **步骤**: 请求该别名
- **预期结果**: `weightedSelect` 返回空；模型不匹配任何后端，行为等同于无别名
- **优先级**: P1

### TC-DIS-013: disabled 不影响字符串格式别名
- **前置条件**: `"glm5.1": "baidu/glm5.1"`（字符串格式）
- **步骤**: 请求 `model: "glm5.1"`
- **预期结果**: `body.model` 替换为 `"baidu/glm5.1"`，正常路由（字符串格式无 disabled 概念）
- **优先级**: P0

### TC-DIS-014: 混合 disabled 和正常目标的加权
- **前置条件**: `a (w:5), b (disabled:true, w:3), c (w:2)`
- **步骤**: 多次请求
- **预期结果**: 仅 `a` 和 `c` 参与选择，比例约 5:2；`b` 从不出现
- **优先级**: P0

## 4. 集成测试

### TC-DIS-015: 服务启动加载含 disabled 的配置
- **前置条件**: `test.config.json` 包含 disabled 示例
- **步骤**: 启动服务 `npm run dev -- --config test.config.json`
- **预期结果**: 服务正常启动，日志无配置验证错误；disabled 后端日志记录正确
- **优先级**: P0

### TC-DIS-016: 向后兼容 — 旧配置无 disabled 字段
- **前置条件**: 使用原始 `test.config.json`（无 disabled 字段）
- **步骤**: 启动服务，发送请求
- **预期结果**: 所有原有行为不变，无报错
- **优先级**: P0
