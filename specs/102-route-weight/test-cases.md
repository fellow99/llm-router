# 路由权重 (102) 测试用例

> 需求编号: 102-route-weight
> 生成时间: 2026-05-12

## 1. 类型与配置测试

### TC-WGT-001: Zod Schema 接受字符串别名（向后兼容）

- **前置条件**: 无
- **步骤**: 使用仅含字符串别名的 config 启动应用
- **预期结果**: ConfigSchema.safeParse 通过，aliases 类型正确
- **优先级**: P0

### TC-WGT-002: Zod Schema 接受加权别名

- **前置条件**: 无
- **步骤**: 使用包含对象格式别名的 config
- **预期结果**: ConfigSchema.safeParse 通过，weight 和 fallback 字段正确解析
- **优先级**: P0

### TC-WGT-003: Zod Schema 接受混合格式

- **前置条件**: 无
- **步骤**: 使用同时包含字符串和对象别名的 config
- **预期结果**: ConfigSchema.safeParse 通过，两种格式正确区分
- **优先级**: P0

### TC-WGT-004: Zod Schema 拒绝非法配置

- **前置条件**: 无
- **步骤**: 使用 weight 为负数的配置
- **预期结果**: ConfigSchema.safeParse 失败，返回 weight must be positive 错误
- **优先级**: P1

### TC-WGT-005: Zod Schema 默认 fallback 为 false

- **前置条件**: 无
- **步骤**: 使用未指定 fallback 字段的加权别名
- **预期结果**: fallback 默认为 false
- **优先级**: P1

## 2. 加权选择测试

### TC-WGT-006: 加权随机选择基本功能

- **前置条件**: 配置 `"test": { "a/model": {"weight": 0.5}, "b/model": {"weight": 0.5} }`
- **步骤**: 多次请求 `model: "test"`
- **预期结果**: 请求随机分配到 a/model 或 b/model，两者出现频率接近 50%
- **优先级**: P0

### TC-WGT-007: 非 fallback 目标不被选中

- **前置条件**: 配置 `"test": { "a/model": {"weight": 1}, "b/model": {"weight": 0.5, "fallback": true} }`
- **步骤**: 发送请求 `model: "test"`
- **预期结果**: 始终选中 a/model，b/model 不被选中（因为只有它标记了 fallback）
- **优先级**: P0

### TC-WGT-008: 全部标记 fallback 的边缘情况

- **前置条件**: 配置所有目标 `fallback: true`
- **步骤**: 发送请求 `model: "test"`
- **预期结果**: 选择第一个 fallback 作为主后端，其余为 fallback 列表
- **优先级**: P1

### TC-WGT-009: 字符串别名不变

- **前置条件**: 配置 `"test": "baidu/model"`（旧格式）
- **步骤**: 发送请求 `model: "test"`
- **预期结果**: `body.model` 替换为 `"baidu/model"`，行为与之前完全一致
- **优先级**: P0

## 3. Fallback 重试测试

### TC-WGT-010: 主后端失败触发 fallback

- **前置条件**: 加权别名配置中有一个 fallback 目标
- **步骤**: 发送请求，主后端返回错误
- **预期结果**: 自动切换到 fallback 目标重试
- **优先级**: P0

### TC-WGT-011: 所有 fallback 均失败

- **前置条件**: 加权别名配置，所有后端（包括 fallback）均不可用
- **步骤**: 发送请求
- **预期结果**: 返回 502 `backend_unreachable` 错误
- **优先级**: P1

### TC-WGT-012: 无 fallback 的加权别名不重试

- **前置条件**: 加权别名无 fallback 目标
- **步骤**: 发送请求，主后端返回错误
- **预期结果**: 直接返回 502，不触发任何重试
- **优先级**: P0

### TC-WGT-013: 字符串别名不触发 fallback

- **前置条件**: 使用旧格式字符串别名
- **步骤**: 发送请求，后端返回错误
- **预期结果**: 直接返回 502，无 fallback 行为
- **优先级**: P1

## 4. 集成测试

### TC-WGT-014: 服务启动加载加权配置

- **前置条件**: test.config.json 包含加权别名
- **步骤**: 启动服务 `npm run dev -- --config test.config.json`
- **预期结果**: 服务正常启动，日志无配置验证错误
- **优先级**: P0
