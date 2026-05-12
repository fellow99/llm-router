import type { BackendConfig, ChatCompletionRequest } from '../types';

export function applyAlias(body: ChatCompletionRequest, aliases: Record<string, string>): ChatCompletionRequest {
  if (body.model && aliases[body.model]) {
    body.model = aliases[body.model];
  }
  return body;
}

export function matchBackend(
  model: string,
  backends: BackendConfig[],
): { backend: BackendConfig; modelWithoutPrefix: string } | null {
  for (const backend of backends) {
    if (model.startsWith(backend.prefix)) {
      return {
        backend,
        modelWithoutPrefix: model.slice(backend.prefix.length),
      };
    }
  }
  return null;
}

export function applyRoleRewrites(
  body: ChatCompletionRequest,
  roleRewrites: Record<string, string>,
): ChatCompletionRequest {
  if (!roleRewrites || Object.keys(roleRewrites).length === 0) {
    return body;
  }

  body.messages = body.messages.map(msg => ({
    ...msg,
    role: roleRewrites[msg.role] || msg.role,
  }));

  return body;
}

export function filterUnsupportedParams(
  body: ChatCompletionRequest,
  unsupportedParams: string[],
): ChatCompletionRequest {
  if (!unsupportedParams || unsupportedParams.length === 0) {
    return body;
  }

  for (const param of unsupportedParams) {
    delete (body as any)[param];
  }

  return body;
}
