# LLM-Router 规格文档索引

**项目名称：** LLM-Router  
**版本：** 0.1.0 (TypeScript/Express 重实现)  
**技术栈：** TypeScript 5.7+ / Node.js 20+ / Express 4.21+ / http-proxy-middleware / Zod 3.24+ / Winston  
**文档生成时间：** 2026-05-11  
**最后更新：** 2026-05-11  

> 本项目是 Go 版本 llm-router (v0.2.1) 的 TypeScript 重实现，核心功能保持对等。

---

## 一、文档总览

| 层级 | 分类 | 文档数量 | 说明 |
|------|------|---------|------|
| 整体 | 项目级顶层文档 | 7 | 架构、技术、宪法、结构、API清单、检查清单 |
| 整体 | 整体规格文档 | 5 | overall-* 系列文档 |
| 模块 | 核心模块 | 6 | 001~006 共 6 个功能模块，每个含 spec + plan |
| **合计** | **18 目录 / 23 文件** | | |

---

## 二、项目级顶层文档

全局性的架构、技术、宪法等文档，定义项目基线和开发准则。

| 文档 | 路径 | 说明 |
|------|------|------|
| **宪法原则** | [constitution.md](./constitution.md) | 项目开发原则：源码即真相、模块化架构、配置驱动、透明可观测性、安全优先、OpenAI 兼容、类型安全 |
| **项目结构** | [STRUCTURE.md](./STRUCTURE.md) | TypeScript 项目目录结构、模块职责映射、关键配置文件位置 |
| **技术选型** | [TECH.md](./TECH.md) | 核心技术栈：TypeScript、Express、Zod、Winston、http-proxy-middleware |
| **API 清单** | [API.md](./API.md) | HTTP 端点清单：路由、方法、认证要求、请求/响应格式 |
| **架构总览** | [ARCHITECTURE.md](./ARCHITECTURE.md) | 系统整体架构：Express 中间件链、请求处理流水线、数据流 |
| **检查清单** | [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md) | 规格文档完成度追踪，文档交叉引用 |

### 整体规格文档

描述跨模块的全局规格、方案和数据模型。

| 文档 | 路径 | 说明 |
|------|------|------|
| **整体规格** | [overall-spec.md](./overall-spec.md) | 系统级功能规格：13 项功能需求(FR) + 5 项非功能需求(NFR) |
| **整体方案** | [overall-plan.md](./overall-plan.md) | 系统级技术方案：技术栈、架构设计、依赖关系、风险分析 |
| **数据模型** | [overall-data-model.md](./overall-data-model.md) | 全局数据实体定义：Config、BackendConfig Zod Schema 与 TypeScript 类型 |
| **接口模型** | [overall-api.md](./overall-api.md) | 全局 API 规范：请求/响应 Schema、认证机制、CORS、错误码 |
| **测试用例** | [overall-test-cases.md](./overall-test-cases.md) | 系统级测试用例：7 大类 25+ 测试场景 |

---

## 三、核心模块（001 ~ 006）

### 001 — 配置模块 (Config)

> 配置加载与管理：JSON/YAML 配置文件解析、环境变量加载（.env）、命令行参数覆盖、Zod Schema 验证、API 密钥三级回退。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [001-config-module/spec.md](./001-config-module/spec.md) | 配置模块功能规格：loadConfig、Zod 验证、优先级链、错误处理 |
| 技术方案 | [001-config-module/plan.md](./001-config-module/plan.md) | 配置模块技术方案：三层合并架构、Zod Schema 验证、多格式支持 |

---

### 002 — 代理模块 (Proxy)

> 反向代理创建与管理：多后端代理初始化、请求改写（Director）、认证头注入、调试日志。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [002-proxy-module/spec.md](./002-proxy-module/spec.md) | 代理模块功能规格：initializeProxies、createDirector、事件钩子 |
| 技术方案 | [002-proxy-module/plan.md](./002-proxy-module/plan.md) | 代理模块技术方案：http-proxy-middleware 配置、认证注入决策树 |

---

### 003 — 请求处理模块 (Handler)

> Express 中间件与请求处理：Bearer Token 认证、CORS 预检、模型别名、角色重写、不支持参数过滤、流式检测与路由分发。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [003-handler-module/spec.md](./003-handler-module/spec.md) | 处理模块功能规格：中间件链、路由算法、CORS、错误处理 |
| 技术方案 | [003-handler-module/plan.md](./003-handler-module/plan.md) | 处理模块技术方案：Express 中间件链、别名+前缀路由流程 |

---

### 004 — 数据模型模块 (Model)

> 核心数据结构定义：Config（全局配置）、BackendConfig（后端配置）的 Zod Schema 与 TypeScript 类型。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [004-model-module/spec.md](./004-model-module/spec.md) | 模型模块功能规格：Zod Schema 定义、类型推断、验证规则 |
| 技术方案 | [004-model-module/plan.md](./004-model-module/plan.md) | 模型模块技术方案：Schema 设计策略、类型安全保障 |

---

### 005 — 日志模块 (Logging)

> 结构化日志初始化与配置：Winston 日志器工厂、级别控制、日志脱敏。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [005-logging-module/spec.md](./005-logging-module/spec.md) | 日志模块功能规格：createLogger、级别配置、JSON 格式 |
| 技术方案 | [005-logging-module/plan.md](./005-logging-module/plan.md) | 日志模块技术方案：Winston 配置、子日志器、脱敏策略 |

---

### 006 — 工具模块 (Utils)

> 通用工具函数：日志脱敏、请求体处理、API 密钥生成、流式响应处理。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [006-utils-module/spec.md](./006-utils-module/spec.md) | 工具模块功能规格：redactAuthorization、generateStrongAPIKey、流式处理 |
| 技术方案 | [006-utils-module/plan.md](./006-utils-module/plan.md) | 工具模块技术方案：各函数实现策略、错误处理 |

---

## 四、与 Go 参考版本对照

| Go 模块 | TypeScript 模块 | 对应文档 |
|---------|----------------|---------|
| `cmd/main.go` | `src/app.ts` | ARCHITECTURE.md, overall-plan.md |
| `config/config.go` | `src/config/` | 001-config-module |
| `handler/handler.go` | `src/middleware/` + `src/handler/` | 003-handler-module |
| `proxy/proxy.go` | `src/proxy/` | 002-proxy-module |
| `model/model.go` | `src/types/` | 004-model-module |
| `logging/logging.go` | `src/logger/` | 005-logging-module |
| `utils/utils.go` | `src/utils/` | 006-utils-module |