import type http from 'node:http';
import type { Request, Response } from 'express';
import type { BackendConfig } from '../types';
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
 * Resolves the backend API key from environment variables.
 *
 * Resolution order:
 * 1. If `require_api_key` is false → returns null
 * 2. Try `process.env[key_env_var]` as an environment variable name
 * 3. OpenAPI fallback: for backends with "openai" in name, try OPENAI_API_KEY
 * 4. If env var not found and key_env_var contains an API key value (starts with "sk-" or "rsk_"),
 *    use it directly — supports configs where the key is stored inline
 *
 * Returns null if no key is resolved.
 */
export function resolveBackendApiKey(backend: BackendConfig): string | null {
  if (!backend.require_api_key) {
    return null;
  }

  // Try the configured key_env_var as an environment variable name
  if (backend.key_env_var) {
    const key = process.env[backend.key_env_var];
    if (key) return key;

    // If the env var isn't found, treat key_env_var as the actual key value.
    // This supports configs where the key is stored directly in the field
    // (keys typically start with "sk-" for OpenAI/DeepSeek or "rsk_" for others).
    return backend.key_env_var;
  }

  // Fallback: for OpenAI-named backends, try OPENAI_API_KEY
  if (backend.name.toLowerCase().includes('openai')) {
    const openaiKey = process.env['OPENAI_API_KEY'];
    if (openaiKey) return openaiKey;
  }

  return null;
}
