import type { RequestHandler, Request, Response, NextFunction } from 'express';
import type { RuntimeConfig, ChatCompletionRequest, BackendConfig } from '../types';
import type { ProxyInstances } from '../proxy';
import { applyAlias, matchBackend, applyRoleRewrites, filterUnsupportedParams } from '../middleware/preprocessor';

// ─── Fallback Routing ──────────────────────────────────────────────────────

function routeToBackend(
  req: Request,
  res: Response,
  next: NextFunction,
  proxies: ProxyInstances,
  match: { backend: BackendConfig; modelWithoutPrefix: string },
  fallbackTargets: string[],
  config: RuntimeConfig,
): void {
  const proxy = proxies.proxyMap.get(match.backend.prefix);

  if (!proxy) {
    config.logger.error('Proxy not found for backend', { backend: match.backend.name });
    res.status(502).json({
      error: {
        message: 'Backend proxy not available',
        type: 'server_error',
        code: 'proxy_not_found',
      },
    });
    return;
  }

  if (fallbackTargets.length === 0) {
    config.logger.info('Routing to backend', {
      backend: match.backend.name,
      model: match.modelWithoutPrefix,
    });
    proxy(req, res, next);
    return;
  }

  // Intercept proxy errors to enable fallback retry
  let fallbackIndex = 0;
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown) {
    const typed = body as Record<string, unknown> | undefined;
    const isBackendError = typed?.error &&
      typeof typed.error === 'object' &&
      (typed.error as Record<string, unknown>)?.code === 'backend_unreachable';

    if (isBackendError && fallbackIndex < fallbackTargets.length && !res.headersSent) {
      const fbTarget = fallbackTargets[fallbackIndex++];
      const fbMatch = matchBackend(fbTarget, config.backends);

      if (fbMatch) {
        config.logger.warn('Primary backend failed, trying fallback', {
          original: match.backend.name,
          fallback: fbMatch.backend.name,
          model: fbMatch.modelWithoutPrefix,
        });

        req.body.model = fbMatch.modelWithoutPrefix;
        applyRoleRewrites(req.body, fbMatch.backend.role_rewrites);
        filterUnsupportedParams(req.body, fbMatch.backend.unsupported_params);

        const fbProxy = proxies.proxyMap.get(fbMatch.backend.prefix);
        if (fbProxy) {
          // Keep res.json interceptor active for cascading fallback support.
          // The proxy writes directly to res on success, so the interceptor
          // only fires on error — allowing multiple fallback retries.
          fbProxy(req, res, next);
          return res;
        }
      }
    }

    return originalJson(body);
  };

  config.logger.info('Routing to backend (with fallback)', {
    backend: match.backend.name,
    model: match.modelWithoutPrefix,
    fallbacks: fallbackTargets,
  });

  proxy(req, res, next);
}

// ─── Chat Completions Handler ──────────────────────────────────────────────

export function chatCompletionsHandler(
  config: RuntimeConfig,
  proxies: ProxyInstances,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body as ChatCompletionRequest;

    if (!body || !body.model) {
      return res.status(400).json({
        error: {
          message: 'Invalid request: model is required',
          type: 'invalid_request_error',
        },
      });
    }

    config.logger.info('Chat completion request', {
      model: body.model,
      stream: body.stream || false,
    });

    const { fallbackTargets } = applyAlias(body, config.aliases);

    const match = matchBackend(body.model, config.backends);

    if (!match) {
      if (proxies.defaultProxy) {
        config.logger.info('Using default proxy', { model: body.model });
        return proxies.defaultProxy(req, res, next);
      }

      config.logger.error('No matching backend and no default proxy', { model: body.model });
      return res.status(502).json({
        error: {
          message: 'No backend available for this model',
          type: 'server_error',
          code: 'no_backend',
        },
      });
    }

    const { backend, modelWithoutPrefix } = match;

    body.model = modelWithoutPrefix;

    applyRoleRewrites(body, backend.role_rewrites);

    filterUnsupportedParams(body, backend.unsupported_params);

    req.body = body;

    routeToBackend(req, res, next, proxies, match, fallbackTargets, config);
  };
}
