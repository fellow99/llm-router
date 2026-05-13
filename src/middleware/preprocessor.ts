import type { BackendConfig, ChatCompletionRequest, AliasTarget, AliasValue } from '../types';

// ─── Weighted Random Selection ──────────────────────────────────────────────

function weightedSelect(
  targets: Record<string, AliasTarget>,
  activePrefixes: Set<string>,
): {
  selected: string;
  fallbacks: string[];
} {
  function hasActiveBackend(targetKey: string): boolean {
    for (const prefix of activePrefixes) {
      if (targetKey.startsWith(prefix)) return true;
    }
    return false;
  }

  const active = Object.entries(targets).filter(
    ([key, t]) => !t.disabled && hasActiveBackend(key),
  );

  // Recover: if all targets are on disabled backends, try fallback-labeled ones
  // against active backends even if they were filtered above
  const resolveActive = active.length > 0
    ? active
    : Object.entries(targets).filter(
        ([key, t]) => t.fallback && hasActiveBackend(key),
      );

  if (resolveActive.length === 0) {
    return { selected: '', fallbacks: [] };
  }

  const fallback = resolveActive
    .filter(([, t]) => t.fallback)
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([key]) => key);

  const totalWeight = resolveActive.reduce((sum, [, t]) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  let selected = resolveActive[0][0];
  for (const [key, target] of resolveActive) {
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
  backends: BackendConfig[],
): { fallbackTargets: string[] } {
  if (!body.model || !aliases[body.model]) {
    return { fallbackTargets: [] };
  }

  const aliasValue = aliases[body.model];

  if (typeof aliasValue === 'string') {
    body.model = aliasValue;
    return { fallbackTargets: [] };
  }

  const activePrefixes = new Set(
    backends.filter(b => !b.disabled).map(b => b.prefix),
  );

  const { selected, fallbacks } = weightedSelect(aliasValue, activePrefixes);
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
