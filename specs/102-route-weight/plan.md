# 路由权重 (102) 技术方案

> 需求编号: 102-route-weight
> 生成时间: 2026-05-12

## 1. 技术架构

### 1.1 涉及模块

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/types/index.ts` | 修改 | 新增 `AliasTarget`、`WeightedAlias` 类型，更新 `ConfigSchema` |
| `src/middleware/preprocessor.ts` | 修改 | 重写 `applyAlias` 支持加权选择 |
| `src/handler/chatHandler.ts` | 修改 | 增加 fallback 重试逻辑 |
| `test.config.json` | 修改 | 增加加权别名示例 |

### 1.2 不修改的文件

- `src/proxy/index.ts` — 代理错误处理不变
- `src/proxy/director.ts` — 请求改写不变
- `src/config/index.ts` — 配置加载不变（zod schema 自动适配）
- `src/routes/index.ts` — 路由不变

## 2. 类型定义

### 2.1 新增类型 (src/types/index.ts)

```typescript
// 单个权重目标
export const AliasTargetSchema = z.object({
  weight: z.number().positive("Weight must be positive"),
  fallback: z.boolean().optional().default(false),
});

export type AliasTarget = z.infer<typeof AliasTargetSchema>;

// 别名值：字符串 或 加权目标映射
export type AliasValue = string | Record<string, AliasTarget>;

// 更新 ConfigSchema
aliases: z.record(
  z.string(),
  z.union([
    z.string(),
    z.record(z.string(), AliasTargetSchema),
  ]),
).default({}),
```

### 2.2 运行时类型

```typescript
// Config 类型自动推断更新
export type Config = z.infer<typeof ConfigSchema>;
// aliases: Record<string, string | Record<string, AliasTarget>>
```

## 3. 核心算法

### 3.1 加权随机选择 (src/middleware/preprocessor.ts)

```typescript
function weightedSelect(targets: Record<string, AliasTarget>): {
  selected: string;
  fallbacks: string[];
} {
  // 1. 分离 fallback 目标（用于失败后的重试列表）
  const primary = Object.entries(targets);  // 所有目标都参与加权选择
  const fallback = Object.entries(targets)
    .filter(([_, t]) => t.fallback)
    .sort((a, b) => b[1].weight - a[1].weight)  // 权重降序
    .map(([key]) => key);

  // 2. 加权随机（从所有目标中选取）
  const totalWeight = primary.reduce((sum, [_, t]) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  let selected = primary[0][0];
  for (const [key, target] of primary) {
    random -= target.weight;
    if (random <= 0) {
      selected = key;
      break;
    }
  }

  return { selected, fallbacks: fallback };
}
```

### 3.2 更新 applyAlias

```typescript
export function applyAlias(
  body: ChatCompletionRequest,
  aliases: Record<string, AliasValue>,
): { fallbackTargets: string[] } {
  if (!body.model || !aliases[body.model]) {
    return { fallbackTargets: [] };
  }

  const aliasValue = aliases[body.model];

  if (typeof aliasValue === 'string') {
    // 旧格式：直接替换
    body.model = aliasValue;
    return { fallbackTargets: [] };
  }

  // 新格式：加权选择
  const { selected, fallbacks } = weightedSelect(aliasValue);
  body.model = selected;
  return { fallbackTargets: fallbacks };
}
```

### 3.3 Fallback 重试 (src/handler/chatHandler.ts)

在 `chatCompletionsHandler` 中，代理调用改为带 fallback 的版本：

```typescript
// 保存 fallback 信息
const { fallbackTargets } = applyAlias(body, config.aliases);

// 匹配主后端
const match = matchBackend(body.model, config.backends);

// ... 现有的 role rewrites, param filtering ...

// 代理调用（带 fallback）
routeToBackend(req, res, next, proxies, match, fallbackTargets, config);
```

`routeToBackend` 函数：
```typescript
function routeToBackend(
  req: Request, res: Response, next: NextFunction,
  proxies: ProxyInstances,
  match: { backend: BackendConfig; modelWithoutPrefix: string },
  fallbackTargets: string[],
  config: RuntimeConfig,
): void {
  const proxy = proxies.proxyMap.get(match.backend.prefix);
  if (!proxy) { /* 502 */ return; }

  // 无 fallback：直接代理
  if (fallbackTargets.length === 0) {
    return proxy(req, res, next);
  }

  // 有 fallback：拦截 502 错误
  let fallbackIndex = 0;
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);

  res.json = function(body: any) {
    if (body?.error?.code === 'backend_unreachable'
        && fallbackIndex < fallbackTargets.length
        && !res.headersSent) {
      // 尝试 fallback
      const fbTarget = fallbackTargets[fallbackIndex++];
      const fbMatch = matchBackend(fbTarget, config.backends);
      if (fbMatch) {
        config.logger.warn('Primary backend failed, trying fallback', {
          original: match.backend.name,
          fallback: fbMatch.backend.name,
        });
        req.body.model = fbMatch.modelWithoutPrefix;
        applyRoleRewrites(req.body, fbMatch.backend.role_rewrites);
        filterUnsupportedParams(req.body, fbMatch.backend.unsupported_params);
        const fbProxy = proxies.proxyMap.get(fbMatch.backend.prefix);
        if (fbProxy) return fbProxy(req, res, next);
      }
    }
    return originalJson(body);
  };

  proxy(req, res, next);
}
```

## 4. 测试配置更新

在 `test.config.json` 中增加加权别名示例：

```json
"aliases": {
  "glm5.1": "baidu/glm5.1",
  "weighted-test": {
    "deepseek/deepseek-chat": { "weight": 0.5 },
    "baidu/glm5.1": { "weight": 0.3 },
    "deepseek/deepseek-v4-pro": { "weight": 0.2, "fallback": true }
  }
}
```
