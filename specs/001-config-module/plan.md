# 配置模块 (001) 技术方案

> 模块路径: `src/config/`
> 生成时间: 2026-05-11

## 1. 技术架构

### 1.1 模块结构

```
src/config/
├── index.ts        # 主入口：loadConfig, validateConfig
└── schema.ts       # Zod Schema 定义
```

### 1.2 配置加载流程

```
loadConfig(options)
  │
  ├── 1. parseCommandLine() → CLI 参数
  ├── 2. dotenv.config() → 加载 .env
  ├── 3. readConfigFile(path) → 读取文件内容
  │     ├── .json → jsonc-parser.parse()
  │     └── .yaml/.yml → YAML.parse()
  ├── 4. validateConfig(raw) → Zod Schema 验证
  ├── 5. applyOverrides(config, cliArgs) → 命令行覆盖
  ├── 6. resolveApiKey(config) → 确定最终 API 密钥
  └── 7. return Config
```

### 1.3 Zod Schema 设计

```typescript
// src/config/schema.ts
import { z } from 'zod';

export const BackendConfigSchema = z.object({
  name: z.string().min(1, 'Backend name is required'),
  base_url: z.string().url('Invalid backend URL'),
  prefix: z.string().min(1, 'Backend prefix is required'),
  default: z.boolean().default(false),
  require_api_key: z.boolean().default(false),
  key_env_var: z.string().default(''),
  role_rewrites: z.record(z.string(), z.string()).default({}),
  unsupported_params: z.array(z.string()).default([]),
});

export const ConfigSchema = z.object({
  listening_port: z.number().int().positive().default(11411),
  llmrouter_api_key_env: z.string().default('LLMROUTER_API_KEY'),
  aliases: z.record(z.string(), z.string()).default({}),
  backends: z.array(BackendConfigSchema).min(1, 'At least one backend is required'),
});
```

### 1.4 类型推断

```typescript
type BackendConfig = z.infer<typeof BackendConfigSchema>;
type Config = z.infer<typeof ConfigSchema>;

// 运行时扩展
interface RuntimeConfig extends Config {
  llmrouterApiKey: string;
  useGeneratedKey: boolean;
  logger: Logger;
}
```

## 2. 多格式配置支持

根据文件扩展名自动选择解析器：
- `.json` → JSONC 解析器（jsonc-parser，支持注释和尾逗号）
- `.yaml`, `.yml` → YAML 解析器
- 无扩展名 → 尝试 JSONC，失败后尝试 YAML

## 3. API 密钥回退策略

```typescript
function resolveApiKey(config: Config, cliKey?: string): { key: string; generated: boolean } {
  if (cliKey) return { key: cliKey, generated: false };
  const envKey = process.env[config.llmrouter_api_key_env];
  if (envKey) return { key: envKey, generated: false };
  const generated = generateStrongAPIKey(); // rsk_ + 48 chars
  logger.info(`Generated API key: ${generated}`);
  return { key: generated, generated: true };
}
```

## 4. 错误处理

```typescript
const result = ConfigSchema.safeParse(rawData);
if (!result.success) {
  logger.error('Configuration validation failed:');
  result.error.errors.forEach(err => {
    logger.error(`  ${err.path.join('.')}: ${err.message}`);
  });
  process.exit(1);
}
```

## 5. 改进方向

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 配置热重载 | 监听配置文件变更，自动 reload | P2 |
| 多环境配置 | 支持 config.production.json 等 | P3 |
| 配置合并测试 | 完善 JSON/YAML 一致性测试 | P1 |