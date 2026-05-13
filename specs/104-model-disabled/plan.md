# 模型禁用 (104) 技术方案

> 需求编号: 104-model-disabled
> 生成时间: 2026-05-13

## 1. 技术架构

### 1.1 涉及文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/types/index.ts` | 修改 | `BackendConfigSchema` 和 `AliasTargetSchema` 各增加 `disabled` 字段 |
| `src/middleware/preprocessor.ts` | 修改 | `weightedSelect` 过滤 disabled；`matchBackend` 跳过 disabled 后端 |
| `src/proxy/index.ts` | 修改 | `initializeProxies` 跳过 disabled 后端 |
| `test.config.json` | 修改 | 增加 disabled 示例配置 |
| `README.md` | 修改 | 更新 config.json 文档增加 `disabled` 字段说明 |

### 1.2 不修改的文件

- `src/handler/chatHandler.ts` — matchBackend 行为改变即自动生效
- `src/config/index.ts` — Zod schema 自动适配新字段
- `src/routes/index.ts` — 路由不变
- `src/proxy/director.ts` — 请求改写不变

## 2. 类型定义

### 2.1 BackendConfigSchema 变更 (src/types/index.ts)

```typescript
export const BackendConfigSchema = z.object({
  name: z.string().min(1, "Backend name is required"),
  base_url: z.string().url("Invalid backend URL format"),
  prefix: z.string().min(1, "Backend prefix is required"),
  default: z.boolean().default(false),
  disabled: z.boolean().optional().default(false),  // ← 新增
  require_api_key: z.boolean().default(false),
  api_key: z.string().default(""),
  role_rewrites: z.record(z.string(), z.string()).default({}),
  unsupported_params: z.array(z.string()).default([]),
});
```

### 2.2 AliasTargetSchema 变更 (src/types/index.ts)

```typescript
export const AliasTargetSchema = z.object({
  weight: z.number().positive("Weight must be positive"),
  fallback: z.boolean().optional().default(false),
  disabled: z.boolean().optional().default(false),  // ← 新增
});
```

## 3. 核心逻辑变更

### 3.1 weightedSelect 过滤 disabled (src/middleware/preprocessor.ts)

```typescript
function weightedSelect(targets: Record<string, AliasTarget>): {
  selected: string;
  fallbacks: string[];
} {
  // NEW: filter out disabled targets first
  const active = Object.entries(targets).filter(([, t]) => !t.disabled);

  if (active.length === 0) {
    return { selected: '', fallbacks: [] };
  }

  const primary = active.filter(([, t]) => !t.fallback);
  const fallback = active
    .filter(([, t]) => t.fallback)
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([key]) => key);

  // ... rest of existing logic unchanged
}
```

### 3.2 matchBackend 跳过 disabled (src/middleware/preprocessor.ts)

```typescript
export function matchBackend(
  model: string,
  backends: BackendConfig[],
): { backend: BackendConfig; modelWithoutPrefix: string } | null {
  for (const backend of backends) {
    if (backend.disabled) continue;           // ← 新增
    if (model.startsWith(backend.prefix)) {
      return {
        backend,
        modelWithoutPrefix: model.slice(backend.prefix.length),
      };
    }
  }
  return null;
}
```

### 3.3 initializeProxies 跳过 disabled (src/proxy/index.ts)

```typescript
export function initializeProxies(config: RuntimeConfig): ProxyInstances {
  const proxyMap = new Map<string, RequestHandler>();
  let defaultProxy: RequestHandler | null = null;

  for (const backend of config.backends) {
    if (backend.disabled) {                   // ← 新增
      config.logger.info('Backend disabled, skipping proxy creation', {
        backend: backend.name,
      });
      continue;
    }

    const apiKey = resolveBackendApiKey(backend);
    const proxy = createBackendProxy(backend, apiKey, config.logger);

    proxyMap.set(backend.prefix, proxy);

    if (backend.default) {
      defaultProxy = proxy;
    }

    config.logger.info('Proxy initialized', { ... });
  }

  return { proxyMap, defaultProxy };
}
```

## 4. 边界情况处理

| 场景 | 行为 |
|------|------|
| 所有后端 disabled | 服务正常启动，所有请求返回 502 `no_backend` |
| 默认后端 disabled | `defaultProxy` 为 null，无前缀请求返回 502 |
| 别名所有目标 disabled | `weightedSelect` 返回空 selected，模型不匹配任何后端 |
| disabled 后端在 fallback 链中 | 被 `matchBackend` 跳过，不会进入 fallback 重试 |
| `disabled` 字段缺失 | Zod 默认 `false`，向后兼容 |
