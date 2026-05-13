# 102-route-weight 路由权重 — 开发任务

> 需求编号: 102-route-weight
> 依赖: 所有现有模块（修改现有文件，不创建新模块）
> 源码路径: `src/types/index.ts`, `src/middleware/preprocessor.ts`, `src/handler/chatHandler.ts`

## 任务依赖图

```
T001 (类型定义)
  ↓
T002 (加权选择 + applyAlias 更新)
  ↓
T003 (fallback 重试)
  ↓
T004 (测试配置更新)
  ↓
T005 (TypeScript 编译验证)
  ↓
T006 (功能测试验证)
```

## 任务列表

### Phase 1: 类型定义

- [ ] **T001**: 扩展 ConfigSchema 支持加权别名类型
  - 新增 `AliasTargetSchema` (zod) 和 `AliasTarget` (type)
  - 修改 `aliases` 字段为 `z.union([z.string(), z.record(z.string(), AliasTargetSchema)])`
  - 导出 `AliasValue` 类型
  - 文件: `src/types/index.ts`
  - 验收: `npx tsc --noEmit` 无类型错误

### Phase 2: 加权选择逻辑

- [ ] **T002**: 实现 `weightedSelect` 函数并更新 `applyAlias`
  - 实现加权随机选择算法（归一化权重）
  - 标记 fallback 目标（用于失败后重试列表）
  - `applyAlias` 返回 `{ fallbackTargets: string[] }`
  - 保持旧字符串格式不变
  - 文件: `src/middleware/preprocessor.ts`
  - 验收: 类型安全，旧格式别名行为不变

### Phase 3: Fallback 重试逻辑

- [ ] **T003**: 实现 `routeToBackend` fallback 重试
  - 在 `chatCompletionsHandler` 中接收 fallback 列表
  - 代理响应拦截：检测 502 `backend_unreachable` 错误
  - 按权重降序依次尝试 fallback 目标
  - Wedge 注入：每个 fallback 尝试前重新应用 role_rewrites 和 unsupported_params
  - 文件: `src/handler/chatHandler.ts`
  - 验收: 主后端失败时自动切换到 fallback；所有 fallback 失败时返回 502

### Phase 4: 配置与验证

- [ ] **T004**: 更新测试配置文件
  - 在 `test.config.json` 中增加加权别名示例
  - 保留原有字符串别名确保向后兼容
  - 文件: `test.config.json`
  - 验收: 配置能被正确解析和验证

- [ ] **T005**: TypeScript 编译验证
  - 运行 `npx tsc --noEmit`
  - 确保零类型错误
  - 验收: 编译成功

- [ ] **T006**: 功能测试
  - 验证旧格式别名路由不变
  - 验证加权别名配置加载成功
  - 验证 test.config.json 中加权配置能被 Zod 正确校验
  - 验收: 服务正常启动，配置字段正确
