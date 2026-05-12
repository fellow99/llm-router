# LLM-Router 项目宪法 (Constitution)

> 生成时间: 2026-05-11 | 基于 Go 参考项目规格适配 TypeScript/Express 实现
> 版本: 1.0.0 | 批准日期: 2026-05-11

## 原则 1: 源码即真相 (Source Code is Truth)

所有规范文档中的声明必须能追溯到实际源代码。当文档与代码不一致时，以代码为准。不确定的行为标记为 `[NEEDS CLARIFICATION]`，而非猜测。

## 原则 2: 模块化架构 (Modular Architecture)

系统采用 TypeScript 模块级别的模块化设计。每个模块拥有明确的单一职责：
- `src/config/` 仅负责配置加载与校验
- `src/routes/` + `src/middleware/` 仅负责 HTTP 请求路由、认证与转发
- `src/proxy/` 仅负责反向代理的创建与请求转发
- `src/types/` 仅负责数据结构定义与 Zod Schema
- `src/logger/` 仅负责日志器初始化
- `src/utils/` 提供 无状态 的工具函数

新功能应归入最合适的现有模块，或创建新模块，避免跨职责耦合。

## 原则 3: 配置驱动 (Configuration-Driven)

所有路由行为由配置文件（JSON/YAML）驱动，包括：
- 后端服务定义与路由前缀
- 模型别名映射
- 角色重写规则
- 不支持参数过滤
- API 密钥环境变量

配置优先级：命令行参数 > 环境变量 > .env 文件 > 配置文件 > 默认值。
配置文件使用 Zod Schema 校验，确保类型安全。

## 原则 4: 透明可观测性 (Transparent Observability)

所有请求和响应必须有结构化日志记录。敏感信息（API 密钥）必须脱敏处理。日志级别可配置（debug/info/warn/error）。调试模式下记录完整的请求/响应详情。使用 Pino 结构化日志，确保高性能与低开销。

## 原则 5: 安全优先 (Security First)

- LLM-Router 自身 API 密钥用于认证客户端请求
- 后端 API 密钥通过环境变量注入，不硬编码
- 支持自动生成高强度随机 API 密钥（`rsk_` 前缀 + 48 字符）
- Authorization 头在日志中脱敏（仅显示前 10 和后 4 字符）
- 使用 Zod 进行输入校验，防止注入攻击

## 原则 6: OpenAI API 兼容 (OpenAI API Compatibility)

核心定位是 OpenAI 兼容 API 的反向代理。所有请求转发遵循 OpenAI chat/completions API 协议，支持流式（SSE）和非流式响应。TypeScript 类型定义与 OpenAI API 规范保持一致。

## 原则 7: 类型安全 (Type Safety)

TypeScript 严格模式（`strict: true`）为强制性要求。所有数据结构使用 Zod Schema 进行运行时校验，编译期通过 TypeScript 类型系统保障。禁止使用 `any`、`@ts-ignore`、`@ts-expect-error` 绕过类型检查。

## 原则 7: 类型安全 (Type Safety)

TypeScript 严格模式（`strict: true`）必须在所有源码文件中启用。所有配置对象必须通过 Zod Schema 验证。禁止使用 `any`、`@ts-ignore`、`@ts-expect-error` 抑制类型错误。配置数据使用 Zod Schema 进行运行时验证，同时通过类型推断获得编译期类型安全保障。

## 修正程序

- 对本宪法的修改需经项目维护者审查批准
- 版本号遵循语义化版本规范：MAJOR（不兼容变更）、MINOR（新增原则/扩展）、PATCH（措辞修正）
- 任何与宪法冲突的代码行为视为 Bug