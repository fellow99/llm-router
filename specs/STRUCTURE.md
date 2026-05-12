# LLM-Router 项目目录结构

> 生成时间: 2026-05-11 | 基于 specs-as-built 工作流，参考 Go 版本并适配 TypeScript/Express 实现

## 目录树

```
llm-router/
├── .env.example                       # 环境变量示例文件
├── .gitignore                         # Git 忽略规则
├── README.md                          # 项目说明文档
├── package.json                       # npm 依赖与脚本
├── tsconfig.json                      # TypeScript 编译配置
├── nodemon.json                       # nodemon 开发配置
├── specs/                             # 规格文档目录
│   ├── README.md                      # 文档索引
│   ├── constitution.md                # 项目宪法
│   ├── STRUCTURE.md                   # 本文档
│   ├── TECH.md                        # 技术选型
│   ├── API.md                         # API 清单
│   ├── ARCHITECTURE.md                # 架构总览
│   ├── SPECS_CHECKLIST.md             # 检查清单
│   ├── overall-spec.md                # 整体功能规格
│   ├── overall-plan.md                # 整体技术方案
│   ├── overall-data-model.md          # 数据模型
│   ├── overall-api.md                 # 对外接口模型
│   ├── overall-test-cases.md          # 测试用例
│   ├── 001-config-module/            # 配置模块
│   │   ├── spec.md
│   │   └── plan.md
│   ├── 002-proxy-module/              # 代理模块
│   │   ├── spec.md
│   │   └── plan.md
│   ├── 003-handler-module/            # 请求处理模块
│   │   ├── spec.md
│   │   └── plan.md
│   ├── 004-model-module/              # 数据模型模块
│   │   ├── spec.md
│   │   └── plan.md
│   ├── 005-logging-module/            # 日志模块
│   │   ├── spec.md
│   │   └── plan.md
│   └── 006-utils-module/              # 工具模块
│       ├── spec.md
│       └── plan.md
├── src/                               # 源代码
│   ├── app.ts                         # 应用入口（Express 服务器启动）
│   ├── config/                        # 配置加载与校验
│   │   └── index.ts                   # 配置加载逻辑（JSON/YAML + env + CLI + Zod）
│   ├── middleware/                     # Express 中间件
│   │   ├── auth.ts                    # Bearer Token 认证中间件
│   │   ├── cors.ts                    # CORS 中间件
│   │   └── errorHandler.ts            # 全局错误处理中间件
│   ├── routes/                        # 路由定义
│   │   └── index.ts                   # 路由注册（/chat/completions、健康检查等）
│   ├── handler/                       # 请求处理逻辑
│   │   └── chatHandler.ts             # Chat Completions 请求处理（别名、前缀路由、角色重写、参数过滤）
│   ├── proxy/                         # 反向代理
│   │   └── index.ts                   # 代理创建、Director、Transport
│   ├── types/                         # TypeScript 类型与 Zod Schema
│   │   └── index.ts                   # Config、BackendConfig 等 Zod Schema 与类型导出
│   ├── logger/                        # 日志模块
│   │   └── index.ts                   # Pino 日志器初始化
│   └── utils/                         # 工具函数
│       └── index.ts                   # 日志脱敏、请求体处理、API 密钥生成、响应录制
├── config-sample.json                 # 示例配置文件（JSON）
├── config-sample.yaml                 # 示例配置文件（YAML）
└── dist/                              # 编译输出（.gitignore）
```

## 模块职责映射

| 目录 | 模块 | 职责 | 核心导出 |
|------|------|------|---------|
| `src/app.ts` | 应用入口 | 初始化 Express、加载配置、注册中间件与路由、启动 HTTP 服务 | `createApp()`, `startServer()` |
| `src/config/` | 配置模块 | 配置文件解析（JSON/YAML）、环境变量加载、命令行参数、Zod 校验 | `loadConfig()`, `validateConfig()` |
| `src/middleware/` | 认证/中间件 | Bearer Token 认证、CORS 处理、错误处理 | `authMiddleware()`, `corsMiddleware()`, `errorHandler()` |
| `src/routes/` | 路由注册 | Express 路由定义与注册 | `registerRoutes()` |
| `src/handler/` | 请求处理 | 模型别名、前缀路由、角色重写、参数过滤 | `chatCompletionsHandler()` |
| `src/proxy/` | 代理模块 | 反向代理创建、请求改写、认证头注入、调试日志 | `initializeProxies()`, `createDirector()` |
| `src/types/` | 数据模型 | Zod Schema 定义、TypeScript 类型推断 | `ConfigSchema`, `BackendConfigSchema`, `Config`, `BackendConfig` |
| `src/logger/` | 日志模块 | Pino 结构化日志初始化 | `createLogger()` |
| `src/utils/` | 工具模块 | 日志脱敏、请求体处理、API 密钥生成、响应录制 | `redactAuthorization()`, `drainBody()`, `generateStrongAPIKey()` |

## 关键配置文件

| 文件 | 路径 | 用途 |
|------|------|------|
| 示例配置 (JSON) | `config-sample.json` | 后端路由、模型别名、角色重写的 JSON 配置模板 |
| 示例配置 (YAML) | `config-sample.yaml` | 后端路由、模型别名、角色重写的 YAML 配置模板 |
| 环境变量 | `.env.example` | API 密钥等敏感配置的模板 |
| TypeScript 配置 | `tsconfig.json` | TypeScript 编译选项（ES2020, strict, commonjs） |
| npm 配置 | `package.json` | 依赖声明与脚本 |
| 开发配置 | `nodemon.json` | nodemon 热重载配置 |
| Git 忽略 | `.gitignore` | 排除 dist/、node_modules/、config.json、.env |