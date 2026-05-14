# 模型/后端禁用 (104) 功能规格

> 需求编号: 104-model-disabled
> 模块路径: `src/types/`, `src/middleware/preprocessor.ts`, `src/handler/chatHandler.ts`, `src/proxy/index.ts`
> 生成时间: 2026-05-13

## 概述

为 `config.json` 的 `backends` 和 `aliases`（加权格式）增加 `disabled` 布尔标记，允许在保留配置的前提下临时禁用某个后端或某个加权路由目标。`disabled: true` 等价于 weight=0（完全排除出路由选择）。

## 功能需求

### FR-DIS-001: 后端 disabled 标记

- `BackendConfig` 新增可选字段 `disabled: boolean`，默认 `false`
- 当 `disabled: true` 时：
  - 该后端不参与前缀路由匹配（`matchBackend` 跳过）
  - 该后端不创建代理实例（`initializeProxies` 跳过）
  - 该后端不能作为 `default` 后端（Zod validation 拒绝）
- Zod schema 校验：`disabled: true` 且 `default: true` 同时存在时，配置校验失败并给出明确错误信息

### FR-DIS-002: 别名条目 disabled 标记

- `AliasTarget` 新增可选字段 `disabled: boolean`，默认 `false`
- 当 `disabled: true` 时：
  - 该目标不参与加权随机选择（`weightedSelect` 过滤掉）
  - 该目标不参与 fallback 列表
- 语义上等价于 `weight=0`，但表达意图更明确

### FR-DIS-003: 向后兼容

- 不配置 `disabled` 字段时行为完全不变（默认 `false`）
- 现有的所有配置格式继续正常工作
- 字符串格式的别名不受影响（disabled 仅应用于加权格式的条目级）

### FR-DIS-004: 日志记录

- 后端 disabled 时：在初始化阶段记录 info 日志 `"Backend disabled, skipping proxy creation"`
- 别名条目 disabled 时：在加权选择阶段记录 debug 日志 `"Alias target disabled, excluded from selection"`
- 不影响正常的路由日志

## 关键数据流

```
配置加载
  │
  ▼
Zod Schema 校验
  ├── BackendConfig: disabled? → 默认 false
  ├── BackendConfig: disabled=true AND default=true → 校验失败，报错
  ├── AliasTarget: disabled? → 默认 false
  └── 通过
  │
  ▼
代理初始化 (initializeProxies)
  ├── 遍历 backends
  ├── disabled=true → skip（不创建 proxy，不设为 default）
  └── disabled=false → 正常创建 proxy
  │
  ▼
请求路由 (chatCompletionsHandler)
  ├── applyAlias → weightedSelect
  │   └── disabled=true 的目标从 primary 和 fallback 中均排除
  ├── matchBackend
  │   └── disabled=true 的后端被跳过
  └── routeToBackend / defaultProxy
```

## 约束

- 不修改现有的 prefix 匹配逻辑
- 不修改 role_rewrites / unsupported_params 逻辑
- 不引入新的外部依赖
- TypeScript strict mode，不使用 any/@ts-ignore
- 保持与 spec 102-route-weight 的兼容性
