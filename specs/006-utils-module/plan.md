# 工具模块 (006) 技术方案

> 模块路径: `src/utils/`
> 生成时间: 2026-05-11

## 1. 技术架构

### 1.1 模块结构

```
src/utils/
├── index.ts       # 统一导出
├── redact.ts      # Authorization 头脱敏
├── keygen.ts      # API 密钥生成
├── stream.ts      # 流式响应处理、响应录制
└── body.ts        # 请求体处理
```

### 1.2 API 密钥生成

```typescript
import crypto from 'crypto';

function generateStrongAPIKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(48);
  let key = 'rsk_';
  for (let i = 0; i < 48; i++) {
    key += chars[randomBytes[i] % chars.length];
  }
  return key;
}
```

- 使用 `crypto.randomBytes` 保证密码学安全
- 48 字节随机数映射到 62 字符集（A-Z, a-z, 0-9）
- 前缀 `rsk_` 便于识别自动生成的密钥

### 1.3 Authorization 头脱敏

```typescript
function redactAuthorization(authHeader: string | undefined): string {
  if (!authHeader) return '(none)';
  if (authHeader.length <= 14) return authHeader.slice(0, 7) + '...';
  return authHeader.slice(0, 10) + '...' + authHeader.slice(-4);
}
```

### 1.4 请求体处理

```typescript
async function drainBody(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

### 1.5 响应录制

```typescript
const MAX_RECORD_SIZE = 1024 * 1024; // 1MB

interface RecordedResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  truncated: boolean;
}

async function recordResponse(res: IncomingMessage): Promise<RecordedResponse> {
  const body = await drainBody(res);
  const truncated = body.length > MAX_RECORD_SIZE;
  return {
    statusCode: res.statusCode || 0,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: truncated ? body.slice(0, MAX_RECORD_SIZE).toString() + '[TRUNCATED]' : body.toString(),
    truncated,
  };
}
```

## 2. 改进方向

| 方向 | 说明 | 优先级 |
|------|------|--------|
| SSE 事件格式化 | 将 SSE 数据块重新组装为可读格式 | P2 |
| 请求体大小限制 | 配置最大请求体大小 | P2 |
| 性能指标 | 请求计数、延迟直方图 | P3 |