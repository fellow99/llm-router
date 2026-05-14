import type { RequestHandler } from 'express';
import type { RuntimeConfig } from '../types';

export function modelsHandler(config: RuntimeConfig): RequestHandler {
  const modelList = Object.keys(config.aliases).map(name => ({
    id: name,
    object: 'model' as const,
    owned_by: 'llm-router',
  }));

  return (_req, res) => {
    res.json({
      object: 'list',
      data: modelList,
    });
  };
}
