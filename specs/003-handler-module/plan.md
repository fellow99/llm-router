# 请求处理模块 (003) 技术方案

> 模块路径: `src/middleware/` + `src/handler/` + `src/routes/`
> 生成时间: 2026-05-11

## 1. 技术选型

| 技术 | 用途 | 理由 |
|------|------|------|
| Express Router | 路由定义 | Express 核心路由功能 |
| body-parser (express.json) | 请求体解析 | Express 内置 JSON 解析 |
| http-proxy-middleware | 代理转发 | 与代理模块集成 |

## 2. 模块结构

```
src/middleware/
  ├── auth.ts                    # Bearer Token 认证中间件
  ├── cors.ts                    # CORS 处理中间件
  └── request-preprocessor.ts    # 模型别名、角色重写、参数过滤

src/handler/
  └── chatHandler.ts             # Chat Completions 请求处理

src/routes/
  ├── index.ts                   # 路由注册与健康检查
  └── chat.ts                    # /chat/completions 路由
```

## 3. 中间件链设计

```
请求 → Express 服务器
  │
  ├── corsMiddleware        # OPTIONS 预检 → 204
  ├── authMiddleware         # Bearer Token → 401
  ├── express.json()        # 请求体解析
  │
  ├── POST /chat/completions
  │     └── chatCompletionsHandler
  │           ├── 读取请求体
  │           ├── 检测流式标记
  │           ├── 应用模型别名 (preprocessRequest)
  │           ├── 匹配后端前缀
  │           ├── 移除前缀
  │           ├── 应用角色重写 (preprocessRequest)
  │           ├── 移除不支持参数 (preprocessRequest)
  │           └── 代理转发
  │
  ├── GET /health
  │     └── healthCheckHandler → {name, version, description}
  │
  └── * (其他路径)
        └── defaultProxyHandler → 默认后端代理
```

## 4. 认证中间件设计

```typescript
function authMiddleware(config: Config): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // OPTIONS 请求跳过认证
    if (req.method === 'OPTIONS') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { message: 'Unauthorized', type: 'authentication_error', code: 'invalid_api_key' }
      });
    }

    const token = authHeader.slice(7);
    if (token !== config.llmrouterApiKey) {
      return res.status(401).json({
        error: { message: 'Unauthorized', type: 'authentication_error', code: 'invalid_api_key' }
      });
    }

    next();
  };
}
```

## 5. 请求预处理设计

```typescript
function preprocessRequest(
  body: ChatCompletionRequest,
  backend: BackendConfig
): ChatCompletionRequest {
  const processed = { ...body };

  // 1. 角色重写
  if (backend.role_rewrites && Object.keys(backend.role_rewrites).length > 0) {
    processed.messages = body.messages.map(msg => ({
      ...msg,
      role: backend.role_rewrites[msg.role] || msg.role,
    }));
  }

  // 2. 参数过滤
  if (backend.unsupported_params && backend.unsupported_params.length > 0) {
    for (const param of backend.unsupported_params) {
      delete processed[param];
    }
  }

  return processed;
}
```

## 6. 前缀路由算法

```typescript
function matchBackend(model: string, proxyMap: Map<string, RequestHandler>, config: Config):
  { proxy: RequestHandler; backend: BackendConfig; targetModel: string } | null {

  // 1. 遍历后端配置，匹配前缀
  for (const backend of config.backends) {
    if (model.startsWith(backend.prefix)) {
      const targetModel = model.slice(backend.prefix.length);
      const proxy = proxyMap.get(backend.prefix);
      if (proxy) {
        return { proxy, backend, targetModel };
      }
    }
  }

  // 2. 无前缀匹配，使用默认后端
  const defaultBackend = config.backends.find(b => b.default);
  if (defaultBackend) {
    const proxy = proxyMap.get(defaultBackend.prefix);
    if (proxy) {
      return { proxy, backend: defaultBackend, targetModel: model };
    }
  }

  // 3. 无匹配
  return null;
}
```

## 7. 改进方向

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 请求限流 | Express rate-limit 中间件 | P2 |
| 请求超时 | 配置代理请求超时时间 | P2 |
| 指标收集 | 请求计数、延迟直方图 | P3 |
| OpenAPI 文档 | 自动生成 API 文档 | P3 |