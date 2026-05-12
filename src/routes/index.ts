import { Router } from 'express';
import type { RuntimeConfig } from '../types';
import type { ProxyInstances } from '../proxy';
import { corsMiddleware } from '../middleware/cors';
import { authMiddleware } from '../middleware/auth';
import { chatCompletionsHandler } from '../handler/chatHandler';

export function createRouter(config: RuntimeConfig, proxies: ProxyInstances): Router {
  const router = Router();

  router.use(corsMiddleware());

  router.use(authMiddleware(config));

  router.get('/health', (_req, res) => {
    res.json({
      name: 'llm-router',
      version: process.env.npm_package_version || '0.1.0',
      description: 'LLM Router - OpenAI-compatible reverse proxy',
    });
  });

  router.post('/chat/completions', chatCompletionsHandler(config, proxies));

  router.all('*', (req, res, next) => {
    if (proxies.defaultProxy) {
      return proxies.defaultProxy(req, res, next);
    }
    res.status(404).json({
      error: {
        message: 'Not found',
        type: 'invalid_request_error',
      },
    });
  });

  return router;
}

const router = Router();
router.get('/', (_req, res) => {
  res.json({
    name: 'llm-router',
    version: process.env.npm_package_version || '0.1.0',
    description: 'LLM Router - OpenAI-compatible reverse proxy',
  });
});

export default router;
