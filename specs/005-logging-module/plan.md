# 日志模块 (005) 技术方案

> 模块路径: `src/logger/`
> 生成时间: 2026-05-11

## 1. 技术架构

### 1.1 模块结构

```
src/logger/
└── index.ts    # 日志器工厂：createLogger, createChildLogger
```

### 1.2 Winston 配置

```typescript
import winston from 'winston';

function createLogger(options: LoggerOptions = {}): winston.Logger {
  return winston.createLogger({
    level: options.level || process.env.LOG_LEVEL || 'warn',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: { service: 'llm-router' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),
    ],
  });
}
```

### 1.3 子日志器

```typescript
function createChildLogger(parent: winston.Logger, defaultFields: Record<string, unknown>): winston.Logger {
  return parent.child(defaultFields);
}

// 使用示例：
const proxyLogger = createChildLogger(logger, { module: 'proxy' });
proxyLogger.info('Request proxied', { method: 'POST', url: '/chat/completions' });
```

### 1.4 脱敏处理

脱敏逻辑在 `src/utils/redact.ts` 中实现，日志模块使用：

```typescript
// 记录请求日志时脱敏
logger.info('Incoming request', {
  method: req.method,
  url: req.url,
  authorization: redactAuthorization(req.headers.authorization),
});
```

## 2. 日志格式

```json
{
  "level": "info",
  "message": "Request proxied",
  "timestamp": "2026-05-11T10:30:00.000Z",
  "service": "llm-router",
  "module": "proxy",
  "method": "POST",
  "url": "/chat/completions",
  "statusCode": 200,
  "duration": 150
}
```

## 3. 改进方向

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 文件日志传输 | 支持日志写入文件 | P3 |
| 日志轮转 | 按大小/时间轮转日志文件 | P3 |
| 远程日志 | 发送日志到 ELK/Datadog | P3 |