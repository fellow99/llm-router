/** ${env:VAR_NAME} 环境变量引用正则 */
export const ENV_PLACEHOLDER_RE = /^\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/;

/**
 * 解析配置中的 API Key 值。
 * - "${env:VAR}" → 读取 process.env[VAR]，不存在则返回 undefined
 * - 非空其他值 → 视为直接 key 值，原样返回
 * - 空字符串 → 返回 undefined
 */
export function resolveEnvValue(raw: string): string | undefined {
  if (!raw) return undefined;

  const match = raw.match(ENV_PLACEHOLDER_RE);
  if (match) {
    const envName = match[1];
    const envVal = process.env[envName];
    if (envVal) return envVal;
    return undefined;
  }

  return raw;
}
