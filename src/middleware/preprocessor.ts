import type { BackendConfig, ChatCompletionRequest, AliasTarget, AliasValue } from '../types';

// ─── Weighted Random Selection ──────────────────────────────────────────────

function weightedSelect(targets: Record<string, AliasTarget>): {
  selected: string;
  fallbacks: string[];
} {
  const entries = Object.entries(targets);

  const primary = entries.filter(([, t]) => !t.fallback);
  const fallback = entries
    .filter(([, t]) => t.fallback)
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([key]) => key);

  if (primary.length === 0) {
    // All targets are fallback: use first as primary, rest as fallbacks
    return { selected: fallback[0] || '', fallbacks: fallback.slice(1) };
  }

  // Weighted random from primary targets
  const totalWeight = primary.reduce((sum, [, t]) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  let selected = primary[0][0];
  for (const [key, target] of primary) {
    random -= target.weight;
    if (random <= 0) {
      selected = key;
      break;
    }
  }

  return { selected, fallbacks: fallback };
}

// ─── Alias Resolution ───────────────────────────────────────────────────────

export function applyAlias(
  body: ChatCompletionRequest,
  aliases: Record<string, AliasValue>,
): { fallbackTargets: string[] } {
  if (!body.model || !aliases[body.model]) {
    return { fallbackTargets: [] };
  }

  const aliasValue = aliases[body.model];

  if (typeof aliasValue === 'string') {
    body.model = aliasValue;
    return { fallbackTargets: [] };
  }

  const { selected, fallbacks } = weightedSelect(aliasValue);
  body.model = selected;
  return { fallbackTargets: fallbacks };
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
