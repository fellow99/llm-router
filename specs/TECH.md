# LLM-Router 技术选型

> 生成时间: 2026-05-11 | 基于 specs-as-built 工作流，参考 Go 版本并适配 TypeScript/Express 实现

## 编程语言与运行时

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 编程语言 | TypeScript | 5.7+ | 主要开发语言，提供类型安全 |
| 运行时 | Node.js | 18+ | JavaScript 运行时 |

## 核心依赖

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| HTTP 框架 | Express | 4.21+ | HTTP 服务器与路由 |
| 反向代理 | http-proxy-middleware | TBD | 创建反向代理，替代 Go 的 httputil.ReverseProxy |
| 配置校验 | Zod | 3.24+ | 运行时 Schema 校验与类型推断 |
| 日志框架 | Pino | TBD | 高性能结构化 JSON 日志（替代 Zap） |
| 环境变量 | dotenv | 16.4+ | 从 .env 文件加载环境变量 |
| YAML 解析 | yaml | 2.7+ | YAML 配置文件解析 |
| JSONC 解析 | jsonc-parser | 3.3+ | 带注释的 JSON 配置文件解析 |

## 开发依赖

| 类别 | 技术 | 用途 |
|------|------|------|
| TypeScript 编译 | typescript 5.7+ | 类型检查与编译 |
| 开发运行 | ts-node + nodemon | 开发时热重载 |
| 类型定义 | @types/express, @types/node | TypeScript 类型支持 |
| 构建 | esbuild | 高速打包（计划中） |
| 测试 | vitest（计划中） | 单元测试与集成测试 |
| 代码规范 | eslint + prettier（计划中） | 代码风格与格式化 |

## 技术选型理由

### Express (替代 Go net/http)

Go 版本使用标准库 `net/http` + `httputil.ReverseProxy`，TypeScript 版本选择 Express 作为 HTTP 框架：
- Node.js 生态最成熟的 HTTP 框架
- 中间件模型清晰，天然支持认证、CORS 等横切关注点
- 社区资源丰富，长期维护保障

### http-proxy-middleware (替代 httputil.ReverseProxy)

- Express 生态最成熟的代理库
- 支持 WebSocket、SSE 流式传输
- 内置路径重写、事件钩子
- TypeScript 原生类型支持

### Pino (替代 Zap)

Go 版本使用 Zap，TypeScript 版本选择 Pino：
- Node.js 性能最高的结构化日志库
- JSON 格式输出，便于日志聚合
- 极低开销（同步写入不阻塞事件循环）
- 支持子日志器、日志级别、脱敏

### Zod (新增)

Go 版本无对应物，TypeScript 版本新增运行时校验：
- 运行时 Schema 校验确保配置数据合法
- 自动推断 TypeScript 类型，消除双维护问题
- 支持嵌套对象、联合类型、转换

### dotenv (替代 godotenv)

- Node.js 生态标准 .env 加载库
- 与 Go 版 godotenv 功能对等

## 架构模式

| 模式 | Go 实现 | TypeScript 实现 |
|------|---------|---------------|
| HTTP 框架 | `net/http` 标准库 | Express + 中间件链 |
| 反向代理 | `httputil.ReverseProxy` + 自定义 `Director` | `http-proxy-middleware` + 自定义路由 |
| 请求中间件 | 手动链式处理 | Express 中间件链（auth → cors → route） |
| 配置管理 | JSON 文件 + 环境变量 + `flag` 包 | JSON/YAML 文件 + dotenv + Zod 校验 |
| 类型系统 | Go 结构体 | TypeScript 接口 + Zod Schema |
| 日志 | Zap 结构化日志 | Pino 结构化 JSON 日志 |
| 响应录制 | 自定义 `ResponseRecorder` | http-proxy-middleware 事件钩子 + 自定义响应录制 |

## 构建与部署

| 类别 | 技术 | 用途 |
|------|------|------|
| 构建 | esbuild | 高速 TypeScript 打包 |
| 开发 | ts-node + nodemon | 开发时热重载 |
| 包管理 | npm | 依赖管理 |
| CI/CD | GitHub Actions（计划中） | 自动测试与发布 |

## 安全技术

| 技术 | 用途 |
|------|------|
| `crypto.randomBytes` | 生成密码学安全的随机 API 密钥 |
| Bearer Token 认证 | 客户端请求认证 |
| 环境变量隔离 | 后端 API 密钥不硬编码 |
| `.gitignore` | 排除 config.json 和 .env 防止泄露 |
| Zod Schema 校验 | 配置输入校验，防止注入 |
| 日志脱敏 | `redactAuthorization()` 函数隐藏密钥 |