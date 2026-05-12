import type { RequestHandler, Request, Response, NextFunction } from 'express';
import type { RuntimeConfig, ChatCompletionRequest } from '../types';
import type { ProxyInstances } from '../proxy';
import { applyAlias, matchBackend, applyRoleRewrites, filterUnsupportedParams } from '../middleware/preprocessor';

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

    applyAlias(body, config.aliases);

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

    const proxy = proxies.proxyMap.get(backend.prefix);
    if (proxy) {
      config.logger.info('Routing to backend', {
        backend: backend.name,
        model: modelWithoutPrefix,
      });
      return proxy(req, res, next);
    }

    config.logger.error('Proxy not found for backend', { backend: backend.name });
    return res.status(502).json({
      error: {
        message: 'Backend proxy not available',
        type: 'server_error',
        code: 'proxy_not_found',
      },
    });
  };
}
