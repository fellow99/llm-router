import type { RequestHandler, Request, Response, NextFunction } from 'express';
import type { RuntimeConfig } from '../types';
import { redactAuthorization } from '../utils';

export function authMiddleware(config: RuntimeConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      config.logger.warn('Invalid or missing API key', {
        receivedAuth: redactAuthorization(authHeader),
      });
      return res.status(401).json({
        error: {
          message: 'Unauthorized',
          type: 'authentication_error',
          code: 'invalid_api_key',
        },
      });
    }

    const token = authHeader.slice(7);
    if (token !== config.llmrouterApiKey) {
      config.logger.warn('Invalid API key', {
        receivedAuth: redactAuthorization(authHeader),
        expectedAuth: redactAuthorization('Bearer ' + config.llmrouterApiKey),
      });
      return res.status(401).json({
        error: {
          message: 'Unauthorized',
          type: 'authentication_error',
          code: 'invalid_api_key',
        },
      });
    }

    config.logger.info('API key validated', {
      authorization: redactAuthorization(authHeader),
    });
    next();
  };
}
