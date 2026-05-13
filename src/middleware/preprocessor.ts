import type { BackendConfig, ChatCompletionRequest, AliasTarget, AliasValue } from '../types';

// ─── Weighted Random Selection ──────────────────────────────────────────────

function weightedSelect(targets: Record<string, AliasTarget>): {
  selected: string;
  fallbacks: string[];
} {
  const active = Object.entries(targets).filter(([, t]) => !t.disabled);

  if (active.length === 0) {
    return { selected: '', fallbacks: [] };
  }

  const fallback = active
    .filter(([, t]) => t.fallback)
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([key]) => key);

  // Weighted random from ALL active targets (including fallback=true)
  const totalWeight = active.reduce((sum, [, t]) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  let selected = active[0][0];
  for (const [key, target] of active) {
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
    if (backend.disabled) continue;
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
