import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { parse as parseJsonc } from 'jsonc-parser';
import { parse as parseYaml } from 'yaml';
import dotenv from 'dotenv';
import { ConfigSchema, formatZodError } from '../types';
import type { Config, RuntimeConfig } from '../types';
import { createLogger } from '../logger';
import { generateStrongAPIKey, resolveEnvValue, ENV_PLACEHOLDER_RE } from '../utils';
import type { Logger } from 'winston';

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

interface CliOptions {
  config: string;
  host: string | undefined;
  port: string | undefined;
  apiKey: string | undefined;
  logLevel: string | undefined;
}

function parseCommandLine(): CliOptions {
  const program = new Command();
  program
    .option('-c, --config <path>', 'Config file path', 'config.json')
    .option('-h, --host <ip>', 'Server listen host (overrides config)')
    .option('-p, --port <port>', 'Server listen port (overrides config)')
    .option('-k, --api-key <key>', 'Northbound API key (overrides config)')
    .option('--log-level <level>', 'Log level (debug/info/warn/error)');

  program.parse();
  const opts = program.opts<{
    config?: string;
    host?: string;
    port?: string;
    apiKey?: string;
    logLevel?: string;
  }>();

  return {
    config: opts.config || 'config.json',
    host: opts.host,
    port: opts.port,
    apiKey: opts.apiKey,
    logLevel: opts.logLevel,
  };
}

// ─── Config File Loading ──────────────────────────────────────────────────────

function loadConfigFile(filePath: string): { data: unknown; raw: Record<string, unknown> } | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  let data: unknown;
  if (ext === '.yaml' || ext === '.yml') {
    data = parseYaml(content);
  } else {
    data = parseJsonc(content);
  }

  return { data, raw: data as Record<string, unknown> };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateConfig(raw: unknown): Config {
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(formatZodError(result.error));
    process.exit(1);
  }
  return result.data;
}

// ─── Server Host Resolution ───────────────────────────────────────────────────

function resolveServerHost(rawHost: string | undefined | null): string {
  if (!rawHost || rawHost === '') {
    return '127.0.0.1';
  }

  if (rawHost === 'true') {
    return '0.0.0.0';
  }

  if (ENV_PLACEHOLDER_RE.test(rawHost)) {
    const resolved = resolveEnvValue(rawHost);
    if (resolved) return resolved;
    return '127.0.0.1';
  }

  return rawHost;
}

// ─── Server Port Resolution ───────────────────────────────────────────────────

function resolveServerPort(rawPort: string | undefined | null): number {
  if (!rawPort || rawPort === '') {
    return 11411;
  }

  let portStr: string | undefined;

  if (ENV_PLACEHOLDER_RE.test(rawPort)) {
    portStr = resolveEnvValue(rawPort);
    if (!portStr) {
      throw new Error(
        `Invalid server port: environment variable for "${rawPort}" not found`
      );
    }
  } else {
    portStr = rawPort;
  }

  const port = Number(portStr);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `Invalid server port: "${portStr}". Port must be a positive integer.`
    );
  }

  return port;
}

// ─── API Key Resolution ───────────────────────────────────────────────────────

function resolveApiKey(
  config: Config,
  cliKey: string | undefined,
  logger: Logger
): { key: string; generated: boolean } {
  // Priority 1: CLI argument
  if (cliKey) {
    return { key: cliKey, generated: false };
  }

  // Priority 2: Config file (server.api_key — supports direct value or ${env:VAR})
  const raw = config.server.api_key;
  if (raw) {
    const resolved = resolveEnvValue(raw);
    if (resolved) {
      return { key: resolved, generated: false };
    }
    if (raw && !ENV_PLACEHOLDER_RE.test(raw)) {
      // Direct value (not ${env:} placeholder, not empty)
      return { key: raw, generated: false };
    }
  }

  // Priority 3: Auto-generate
  const generated = generateStrongAPIKey();
  return { key: generated, generated: true };
}

// ─── Log Helpers ──────────────────────────────────────────────────────────────

function redactKey(key: string, isGenerated: boolean): string {
  if (isGenerated) return key; // auto-generated keys are printed in full
  if (key.length <= 4) return '****';
  return key.slice(0, 4) + '****';
}

function redactBackendKey(rawKey: string): string {
  if (!rawKey) return '';
  if (ENV_PLACEHOLDER_RE.test(rawKey)) {
    const resolved = resolveEnvValue(rawKey);
    if (resolved) return '[REDACTED]';
    return rawKey; // unresolved placeholder, show as-is
  }
  return '[REDACTED]';
}

function resolveAllEnvValues(obj: unknown): unknown {
  if (typeof obj === 'string') {
    if (ENV_PLACEHOLDER_RE.test(obj)) {
      const resolved = resolveEnvValue(obj);
      return resolved ?? obj;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveAllEnvValues);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = resolveAllEnvValues(value);
    }
    return result;
  }
  return obj;
}

// ─── Default Config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Config = {
  server: {
    host: '',
    port: '',
    api_key: '',
  },
  aliases: {},
  backends: [
    {
      name: 'openai',
      base_url: 'https://api.openai.com',
      prefix: 'openai/',
      default: true,
      require_api_key: true,
      api_key: '',
      disabled: false,
      role_rewrites: {},
      unsupported_params: [],
    },
  ],
};

// ─── Main Config Loading ──────────────────────────────────────────────────────

function detectDeprecatedFormat(raw: Record<string, unknown>): void {
  if ('listening_port' in raw || 'llmrouter_api_key' in raw) {
    throw new Error(
      'Detected deprecated flat config format. ' +
        'Please migrate to the new "server" node format. ' +
        'See test.config.json for reference or the migration guide in specs/105-config-server/spec.md.'
    );
  }
}

export function loadConfig(): RuntimeConfig {
  // 1. Parse CLI arguments
  const cli = parseCommandLine();

  // 2. Load .env file
  dotenv.config();

  // 3. Create logger (early, for config loading logs)
  const logger = createLogger({ level: cli.logLevel });

  // 4. Load config file
  const loaded = loadConfigFile(cli.config);

  let config: Config;
  if (loaded) {
    // Check for deprecated flat format before validation
    detectDeprecatedFormat(loaded.raw);
    logger.info('Config file loaded', { file: cli.config });
    config = validateConfig(loaded.data);
  } else {
    logger.warn('Config file not found, using default configuration', { file: cli.config });
    config = validateConfig(DEFAULT_CONFIG);
  }

  // 5. Apply CLI overrides to server config
  if (cli.host !== undefined) {
    config.server.host = cli.host;
    logger.info('Server host override applied', { host: cli.host });
  }
  if (cli.port !== undefined) {
    config.server.port = cli.port;
    logger.info('Server port override applied', { port: cli.port });
  }

  // 6. Resolve server host and port
  const serverHost = resolveServerHost(config.server.host);
  const serverPort = resolveServerPort(config.server.port);

  // 7. Resolve API key
  const { key, generated } = resolveApiKey(config, cli.apiKey, logger);

  if (generated) {
    console.log(`
Your LLM-Router endpoint will be exposed publicly so that Cursor's servers can invoke it.
A strong API key is highly recommended to prevent others from consuming your resources.

You may specify the API key via:
- Config file: set "api_key" under "server" in config.json (direct value)
- Config file: set "api_key" to "\${env:YOUR_ENV_VAR}" to read from environment
- Command line flag: --api-key=your_api_key

Since none was provided, a random key has been generated for this session:
${key}

This is what you should set as your API key in Cursor.
`);
  }

  // 8. Startup logging
  logger.info(`Server listening on ${serverHost}:${serverPort}`);

  const keyPreview = redactKey(key, generated);
  logger.info(`API Key: ${keyPreview}`);

  // Print resolved config with env placeholders resolved and keys redacted
  const resolvedConfig = resolveAllEnvValues({
    server: {
      host: serverHost,
      port: serverPort,
      api_key: keyPreview,
    },
    aliases: config.aliases,
    backends: config.backends.map(b => ({
      ...b,
      api_key: redactBackendKey(b.api_key),
    })),
  });
  logger.info('Resolved config', { config: resolvedConfig });

  // 9. Build RuntimeConfig
  return {
    ...config,
    serverHost,
    serverPort,
    llmrouterApiKey: key,
    useGeneratedKey: generated,
    logger,
  };
}

export type { RuntimeConfig } from '../types';
export { ConfigSchema, BackendConfigSchema, ServerConfigSchema } from '../types';
