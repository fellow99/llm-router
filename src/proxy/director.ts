import type http from 'node:http';
import type { Request, Response } from 'express';
import type { BackendConfig } from '../types';
import { resolveEnvValue } from '../utils';
/**
 * Creates a proxy request callback that rewrites the request for the target backend.
 * - Sets X-Real-IP, X-Forwarded-For, X-Forwarded-Proto proxy headers
 * - Injects or removes Authorization header based on backend config
 */
export function createDirector(
  backend: BackendConfig,
  apiKey: string | null,
): (proxyReq: http.ClientRequest, req: Request, res: Response) => void {
  return (proxyReq: http.ClientRequest, req: Request, _res: Response) => {
    // Set proxy headers
    const ip = req.ip || req.socket?.remoteAddress;
    if (ip) {
      proxyReq.setHeader('X-Real-IP', ip);
      proxyReq.setHeader('X-Forwarded-For', ip);
    }
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);

    // Handle Authorization header
    if (backend.require_api_key && apiKey) {
      proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
    } else {
      proxyReq.removeHeader('Authorization');
    }

    // Write body if express.json() consumed the request stream.
    // Without this, the proxy pipes an empty stream → "socket hang up".
    if (req.body !== undefined && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData).toString());
      proxyReq.write(bodyData);
    }
  };
}

/**
 * Resolves the backend API key from the `api_key` config field.
 *
 * Resolution order:
 * 1. If `require_api_key` is false → returns null
 * 2. Try resolving `backend.api_key`:
 *    - "${env:VAR}" → reads process.env[VAR]
 *    - non-empty other value → treated as a direct key value
 * 3. OpenAPI fallback: for backends with "openai" in name, try OPENAI_API_KEY
 *
 * Returns null if no key is resolved.
 */
export function resolveBackendApiKey(backend: BackendConfig): string | null {
  if (!backend.require_api_key) {
    return null;
  }

  const resolved = resolveEnvValue(backend.api_key);
  if (resolved) return resolved;

  if (backend.name.toLowerCase().includes('openai')) {
    const openaiKey = process.env['OPENAI_API_KEY'];
    if (openaiKey) return openaiKey;
  }

  return null;
}
