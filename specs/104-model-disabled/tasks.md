# 104-model-disabled 模型禁用 — 开发任务

> 需求编号: 104-model-disabled
> 依赖: 102-route-weight（修改现有文件，不创建新模块）
> 源码路径: `src/types/index.ts`, `src/middleware/preprocessor.ts`, `src/proxy/index.ts`

## 任务依赖图

```
T001 (类型定义)
  ↓
T002 (weightedSelect 过滤 disabled)
  ├── 可与 T003 并行
  ↓
T003 (matchBackend 跳过 disabled)
  ├── 可与 T002 并行
  ↓
T004 (initializeProxies 跳过 disabled)
  ↓
T005 (测试配置更新)
  ↓
T006 (README 文档更新)
  ↓
T007 (TypeScript 编译验证)
  ↓
T008 (功能测试)
```

## 任务列表

### Phase 1: 类型定义

- [ ] **T001**: 扩展 Schema 支持 `disabled` 字段
  - `BackendConfigSchema` 新增 `disabled: z.boolean().optional().default(false)`
  - `AliasTargetSchema` 新增 `disabled: z.boolean().optional().default(false)`
  - 文件: `src/types/index.ts`
  - 验收: `npx tsc --noEmit` 无类型错误；`ConfigSchema.safeParse` 接受含 `disabled` 的配置

### Phase 2: 路由逻辑变更

- [ ] **T002**: `weightedSelect` 过滤 disabled 目标
  - 在 `weightedSelect` 开头过滤掉 `disabled: true` 的目标
  - 所有目标都 disabled 时返回 `{ selected: '', fallbacks: [] }`
  - 文件: `src/middleware/preprocessor.ts`
  - 验收: disabled 目标不参与加权选择和 fallback

- [ ] **T003**: `matchBackend` 跳过 disabled 后端
  - 在 `matchBackend` 循环中添加 `if (backend.disabled) continue`
  - 文件: `src/middleware/preprocessor.ts`
  - 验收: 带 disabled 后端前缀的模型无法匹配到该后端

- [ ] **T004**: `initializeProxies` 跳过 disabled 后端
  - 在遍历 backends 时跳过 disabled 后端
  - 记录 info 日志
  - 文件: `src/proxy/index.ts`
  - 验收: disabled 后端无 proxy 实例、无日志 "Proxy initialized"

### Phase 3: 配置与文档

- [ ] **T005**: 更新 `test.config.json`
  - 在 backends 中增加一个 `disabled: true` 的后端示例
  - 在加权别名中增加一个 `disabled: true` 的目标示例
  - 保留原有配置确保向后兼容
  - 文件: `test.config.json`
  - 验收: 配置能被 Zod 正确解析

- [ ] **T006**: 更新 `README.md`
  - 在 backends 配置段增加 `disabled` 字段说明
  - 在加权别名配置段增加 `disabled` 字段说明
  - 文件: `README.md`
  - 验收: 文档准确描述 `disabled` 字段含义和默认值

### Phase 4: 编译验证

- [ ] **T007**: TypeScript 编译验证
  - 运行 `npx tsc --noEmit`
  - 确保零类型错误
  - 验收: 编译成功

### Phase 5: 功能测试

- [ ] **T008**: 功能测试
  - 验证 `test.config.json` 中 disabled 配置被正确解析
  - 验证 disabled 后端不创建 proxy
  - 验证 disabled 别名目标不参与路由选择
  - 验收: 服务正常启动，行为符合预期
