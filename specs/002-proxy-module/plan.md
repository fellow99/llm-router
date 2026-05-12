# 代理模块 (002) 技术方案

> 模块路径: `src/proxy/`
> 生成时间: 2026-05-11

## 1. 技术架构

### 1.1 模块结构

```
src/proxy/
├── index.ts       # 主入口：initializeProxies, proxyMap, defaultProxy
└── director.ts    # 请求改写：createDirector, 认证注入
```

### 1.2 http-proxy-middleware 配置

```typescript
import { createProxyMiddleware } from 'http-proxy-middleware';

function createBackendProxy(backend: BackendConfig, apiKey: string | null): RequestHandler {
  return createProxyMiddleware({
    target: backend.base_url,
    changeOrigin: true,
    selfHandleResponse: false,  // SSE 流式直通
    on: {
      proxyReq: createDirector(backend, apiKey),
      proxyRes: handleProxyResponse,
    },
    onError: handleProxyError,
  });
}
```

### 1.3 认证注入决策树

```
后端认证注入 (onProxyReq):
  │
  ├── require_api_key = true?
  │     ├── key_env_var 有值?
  │     │     ├── process.env[key_env_var] 有值 → 设置 Authorization: Bearer <key>
  │     │     └── 为空且后端名含 "openai"? → 回退 OPENAI_API_KEY
  │     └── key_env_var 为空? → 同上回退逻辑
  │
  └── require_api_key = false?
        └── 移除 Authorization 头
```

### 1.4 代理映射管理

```typescript
interface ProxyInstances {
  proxyMap: Map<string, RequestHandler>;  // prefix → proxy
  defaultProxy: RequestHandler | null;
}

function initializeProxies(config: Config, logger: Logger): ProxyInstances {
  const proxyMap = new Map<string, RequestHandler>();
  let defaultProxy: RequestHandler | null = null;

  for (const backend of config.backends) {
    const apiKey = resolveBackendApiKey(backend);
    const proxy = createBackendProxy(backend, apiKey);
    proxyMap.set(backend.prefix, proxy);
    if (backend.default) defaultProxy = proxy;
  }

  return { proxyMap, defaultProxy };
}
```

### 1.5 错误处理

```typescript
function handleProxyError(err: Error, req: Request, res: Response) {
  logger.error(`Proxy error: ${err.message}`, { method: req.method, url: req.url });
  if (!res.headersSent) {
    res.status(502).json({
      error: { message: 'Backend service unavailable', type: 'server_error', code: 'backend_unreachable' }
    });
  }
}
```

## 2. 改进方向

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 连接池配置 | 超时、keep-alive、最大连接数 | P2 |
| 后端健康检查 | 定期检查后端可用性 | P3 |
| 响应录制 | 非流式响应录制用于日志 | P2 |