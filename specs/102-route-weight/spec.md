# 路由权重 (102) 功能规格

> 需求编号: 102-route-weight
> 模块路径: `src/types/`, `src/middleware/preprocessor.ts`, `src/handler/chatHandler.ts`
> 生成时间: 2026-05-12

## 概述

扩展 `config.json` 的 `aliases` 配置，支持将一个别名映射到多个后端，每个后端可配置权重（`weight`）和回退标记（`fallback`），同时保持对现有字符串格式的向后兼容。

## 功能需求

### FR-WGT-001: 向后兼容的别名配置

- 现有的字符串格式 `"alias": "provider/model"` 必须继续工作
- 字符串别名行为不变：直接替换 `body.model` 后走前缀路由
- 字符串和对象格式可在同一 `aliases` 配置中共存

### FR-WGT-002: 多后端加权别名

- 支持对象格式：
  ```json
  "alias": {
    "provider1/model": { "weight": 0.6 },
    "provider2/model": { "weight": 0.4 }
  }
  ```
- 每个目标包含 `weight`（number，正数）和可选的 `fallback`（boolean，默认 false）
- 权重归一化：总和不强制为 1.0，按比例分配
- 加权随机选择从所有目标（包括 fallback）中选取

### FR-WGT-003: 回退路由 (Fallback)

- `fallback: true` 的目标也会参与正常加权选择，同时作为回退候选
- 当加权选择的后端请求失败（代理返回 502/连接错误）时，按权重降序依次尝试 fallback 目标
- 所有 fallback 都失败时，返回最终 502 错误

### FR-WGT-004: Zod Schema 验证

- `aliases` 字段类型扩展为 `Record<string, string | Record<string, AliasTarget>>`
- `AliasTarget` 包含 `{ weight: number, fallback?: boolean }`
- 无效配置（如 weight 为负）在启动时捕获并报错

### FR-WGT-005: 日志记录

- 加权选择结果记录 info 日志（选中哪个后端）
- 回退触发时记录 warn 日志（原后端失败，尝试 fallback）
- 回退成功/失败均记录相应日志

## 关键数据流

```
请求 model: "glm5.1"
  │
  ▼
applyAlias (加权选择)
  ├── 所有目标: aliyun/glm5.1 (0.2), baidu/glm5.1 (0.4), deepseek/glm5.1 (0.3, fallback)
  ├── 加权随机 → 选中 baidu/glm5.1
  └── body.model = "baidu/glm5.1"
  │
  ▼
matchBackend → 匹配 baidu 后端
  │
  ▼
代理请求 → baidu 后端
  │
  ├── 成功 → 正常返回
  └── 失败 (502) →
        ├── 检查 fallback 列表
        ├── 尝试 deepseek/glm5.1
        ├── 成功 → 返回
        └── 失败 → 返回 502
```

## 约束

- 不修改 BackendConfig 结构
- 不修改 matchBackend / applyRoleRewrites / filterUnsupportedParams
- 不引入新的外部依赖
- TypeScript strict mode，不使用 any/@ts-ignore
