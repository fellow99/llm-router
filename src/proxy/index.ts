import { createProxyMiddleware } from 'http-proxy-middleware';
import type { RequestHandler, Request, Response } from 'express';
import type { RuntimeConfig, BackendConfig } from '../types';
import { createChildLogger } from '../logger';
import type { Logger } from 'winston';
import { createDirector, resolveBackendApiKey } from './director';
import type { Socket } from 'node:net';

/**
 * Proxy instances container.
 * Holds mapped proxy handlers for each backend and an optional default proxy.
 */
export interface ProxyInstances {
  proxyMap: Map<string, RequestHandler>;
  defaultProxy: RequestHandler | null;
}

/**
 * Handles proxy errors by returning 502 Bad Gateway to the client.
 */
function handleProxyError(err: Error, req: Request, res: Response): void {
  if (!res.headersSent) {
    res.status(502).json({
      error: {
        message: 'Backend service unavailable',
        type: 'server_error',
        code: 'backend_unreachable',
      },
    });
  }
}

/**
 * Creates a proxy middleware instance for a specific backend.
 */
function createBackendProxy(
  backend: BackendConfig,
  apiKey: string | null,
  logger: Logger,
): RequestHandler {
  const proxyLogger = createChildLogger(logger, { module: 'proxy', backend: backend.name });

  return createProxyMiddleware<Request, Response>({
    target: backend.base_url,
    changeOrigin: true,
    selfHandleResponse: false,
    on: {
      proxyReq: createDirector(backend, apiKey),
      error: (err: Error, req: Request, res: Response | Socket) => {
        proxyLogger.error('Proxy error', {
          method: req.method,
          url: req.url,
          error: err.message,
        });
        if ('status' in res && typeof (res as Response).status === 'function') {
          handleProxyError(err, req, res as Response);
        } else {
          (res as Socket).destroy();
        }
      },
    },
  });
}

/**
 * Initializes proxy instances for all configured backends.
 * Returns mapped proxy handlers by prefix and the default proxy.
 */
export function initializeProxies(config: RuntimeConfig): ProxyInstances {
  const proxyMap = new Map<string, RequestHandler>();
  let defaultProxy: RequestHandler | null = null;

  for (const backend of config.backends) {
    if (backend.disabled) {
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
      config.logger.info('Default proxy set', { backend: backend.name });
    }

    config.logger.info('Proxy initialized', {
      backend: backend.name,
      prefix: backend.prefix,
      hasApiKey: !!apiKey,
    });
  }

  return { proxyMap, defaultProxy };
}

export { createDirector, resolveBackendApiKey } from './director';
