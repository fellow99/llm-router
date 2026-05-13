# 在 config.json 中读取环境变量 (103) 任务分解

> 需求编号: 103-json-use-env
> 基于: spec.md, plan.md
> 生成时间: 2026-05-13

## 任务列表

### TASK-001: 提取 `${env:}` 解析工具函数到 utils 模块

**优先级**: P0 (阻塞后续任务)
**依赖**: 无

- 在 `src/utils/` 中新增或修改文件，导出 `resolveEnvValue` 函数和 `ENV_PLACEHOLDER_RE` 正则
- `resolveEnvValue(raw: string): string | undefined`
  - 匹配 `${env:VAR_NAME}` 格式 → 返回 `process.env[VAR_NAME]`
  - 非匹配且非空 → 返回原值（直接 key）
  - 空字符串 → 返回 `undefined`

**验证**: 单元测试通过（空值、直接值、${env:}存在、${env:}不存在）

---

### TASK-002: 更新 Zod Schema 字段名

**优先级**: P0
**依赖**: 无

- `src/types/index.ts`：
  - `ConfigSchema`: 移除 `llmrouter_api_key_env`，新增 `llmrouter_api_key: z.string().default("")`
  - `BackendConfigSchema`: 移除 `key_env_var`，新增 `api_key: z.string().default("")`
- 确保 `BackendConfig` 和 `Config` 类型正确推导

**验证**: TypeScript 编译通过，类型检查无错误

---

### TASK-003: 重写 resolveApiKey 函数

**优先级**: P0
**依赖**: TASK-001, TASK-002

- `src/config/index.ts`：
  - 重写 `resolveApiKey()`，使用 `resolveEnvValue` 解析 `config.llmrouter_api_key`
  - 优先级：CLI key → config key (含 ${env:}) → 自动生成
  - 更新自动生成时的提示信息（引用新字段名）

**验证**: 编译通过；手动测试各种场景

---

### TASK-004: 重写 resolveBackendApiKey 函数

**优先级**: P0
**依赖**: TASK-001, TASK-002

- `src/proxy/director.ts`：
  - 重写 `resolveBackendApiKey()`，使用 `resolveEnvValue` 解析 `backend.api_key`
  - 替换原来对 `key_env_var` 的引用
  - 保留 OPENAI_API_KEY fallback

**验证**: 编译通过；backend key 解析正确

---

### TASK-005: 清理 CLI 参数

**优先级**: P1
**依赖**: TASK-003

- `src/config/index.ts`：
  - 移除 `CliOptions.llmrouterApiKeyEnv`
  - 移除 `--llmrouter-api-key-env` option 定义
  - 移除 `loadConfig()` 中 `cli.llmrouterApiKeyEnv` 对 `config.llmrouter_api_key_env` 的覆盖代码
  - 移除相应 import（如 `CliOptions` 中不再有该字段）

**验证**: 编译通过；`--help` 不再显示该参数

---

### TASK-006: 更新 DEFAULT_CONFIG

**优先级**: P1
**依赖**: TASK-002

- `src/config/index.ts`：
  - `llmrouter_api_key_env: 'LLMROUTER_API_KEY'` → `llmrouter_api_key: ''`
  - 如后端数组中有 `key_env_var` 字段，替换为 `api_key`（或省略由 default 接管）

**验证**: 编译通过；无配置文件时启动成功

---

### TASK-007: 更新提示文案

**优先级**: P2
**依赖**: TASK-003

- `src/config/index.ts`：更新自动生成 key 时的 console.log 提示，引用 `llmrouter_api_key` 和 `${env:}` 语法

**验证**: 无配置文件时输出正确的提示信息

---

### TASK-008: 类型编译验证

**优先级**: P0
**依赖**: TASK-001~TASK-007

- 运行 `npm run build` (tsc) 确保整体编译通过
- 检查 `src/config/schema.ts` 的 re-export 是否自动跟随类型变更

**验证**: `tsc --noEmit` 零错误

---

### TASK-009: 更新 specs/001-config-module/spec.md

**优先级**: P1
**依赖**: 无 (文档任务)

- 更新 FR-CFG-003（命令行参数）：移除 `--llmrouter-api-key-env` 的引用
- 更新 FR-CFG-006（API 密钥三级回退）：描述新的 `llmrouter_api_key` 字段和 `${env:}` 语法
- 更新 FR-CFG-007（默认配置）：移除默认环境变量名描述
- 新增 FR-CFG-008（环境变量插值）：描述 `${env:VAR_NAME}` 语法

**验证**: 人工审查文档准确性

---

### TASK-010: 更新 specs/001-config-module/plan.md

**优先级**: P1
**依赖**: TASK-009

- 更新 1.3 Zod Schema 设计代码示例
- 更新 3. API 密钥回退策略代码示例
- 更新配置加载流程图（移除说明 --llmrouter-api-key-env 的步骤）

**验证**: 代码示例与实际实现一致

---

### TASK-011: 更新 README.md

**优先级**: P1
**依赖**: 无 (文档任务)

- 更新 config.json 配置示例为新格式
- 添加 `${env:VAR_NAME}` 语法的说明
- 更新命令行参数说明（移除 `--llmrouter-api-key-env`）

**验证**: 人工审查

---

### TASK-012: 更新 specs/004-model-module/plan.md

**优先级**: P2
**依赖**: 无 (文档任务)

- 更新 1.3 Schema 代码示例中的 `key_env_var` → `api_key`，`llmrouter_api_key_env` → `llmrouter_api_key`
- 更新条件依赖表中 `key_env_var` 相关说明

**验证**: 人工审查

---

### TASK-013: 更新 specs/004-model-module/tasks.md

**优先级**: P2
**依赖**: 无 (文档任务)

- 更新验收标准中的字段名引用

**验证**: 人工审查

---

### TASK-014: 更新 specs/002-proxy-module/*

**优先级**: P2
**依赖**: 无 (文档任务)

- `specs/002-proxy-module/spec.md`：更新 `key_env_var` → `api_key`，描述新的 `${env:}` 语法
- `specs/002-proxy-module/plan.md`：更新 key 解析流程图中 `key_env_var` → `api_key`
- `specs/002-proxy-module/tasks.md`：更新验收标准中的字段名引用

**验证**: 人工审查

---

### TASK-015: 更新 specs/overall-* 文档

**优先级**: P3
**依赖**: 无 (文档任务)

- `specs/overall-spec.md`：更新 `key_env_var` → `api_key`
- `specs/overall-data-model.md`：更新字段定义表
- `specs/overall-api.md`：更新后端认证说明和流程图
- `specs/overall-test-cases.md`：更新测试用例中的字段名引用

**验证**: 人工审查

---

### TASK-016: 功能验证

**优先级**: P0
**依赖**: TASK-001~TASK-008

- 使用 `test.config.json` 作为参考，验证新格式配置文件能正确加载
- 验证各种场景：
  - `${env:VAR}` 且环境变量存在
  - `${env:VAR}` 且环境变量不存在
  - 直接写入 key 值
  - 字段为空字符串

**验证**: 所有场景行为符合 spec.md 定义

---

## 执行顺序

```
TASK-001 ──┬── TASK-003 ──┬── TASK-005 ──┬── TASK-008
           │              │              │
TASK-002 ──┼── TASK-004 ──┤              │
           │              │              │
           │              └── TASK-006 ──┤
           │                             │
           └── TASK-007 ─────────────────┘
                                          │
TASK-009 ── TASK-010                     │
                                          │
TASK-011                                  │
                                          │
TASK-012 ── TASK-013 ── TASK-014         │
                                          │
TASK-015                                  │
                                          │
                                          ├── TASK-016
```

- P0 代码任务可并行：TASK-001 和 TASK-002 无相互依赖
- 文档任务（TASK-009~TASK-015）可与代码任务并行
- TASK-016 依赖所有代码任务完成
