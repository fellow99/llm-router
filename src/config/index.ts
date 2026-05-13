import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { parse as parseJsonc } from 'jsonc-parser';
import { parse as parseYaml } from 'yaml';
import dotenv from 'dotenv';
import { ConfigSchema, formatZodError } from '../types';
import type { Config, RuntimeConfig } from '../types';
import { createLogger } from '../logger';
import { generateStrongAPIKey, resolveEnvValue } from '../utils';
import type { Logger } from 'winston';

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

interface CliOptions {
  config: string;
  port: number | undefined;
  llmrouterApiKey: string | undefined;
  logLevel: string | undefined;
}

function parseCommandLine(): CliOptions {
  const program = new Command();
  program
    .option('--config <path>', 'Config file path', 'config.json')
    .option('--port <number>', 'Listening port')
    .option('--llmrouter-api-key <key>', 'LLM Router API key')
    .option('--log-level <level>', 'Log level (debug/info/warn/error)');

  program.parse();
  const opts = program.opts<{
    config?: string;
    port?: string;
    llmrouterApiKey?: string;
    logLevel?: string;
  }>();

  return {
    config: opts.config || 'config.json',
    port: opts.port ? parseInt(opts.port, 10) : undefined,
    llmrouterApiKey: opts.llmrouterApiKey,
    logLevel: opts.logLevel,
  };
}

// ─── Config File Loading ──────────────────────────────────────────────────────

function loadConfigFile(filePath: string): unknown | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.yaml' || ext === '.yml') {
    return parseYaml(content);
  }

  // Default: parse as JSONC (supports comments, trailing commas)
  return parseJsonc(content);
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

// ─── API Key Resolution ───────────────────────────────────────────────────────

function resolveApiKey(config: Config, cliKey?: string): { key: string; generated: boolean } {
  // Priority 1: CLI argument
  if (cliKey) {
    return { key: cliKey, generated: false };
  }

  // Priority 2: Config file (llmrouter_api_key — supports direct value or ${env:VAR})
  const resolved = resolveEnvValue(config.llmrouter_api_key);
  if (resolved) {
    return { key: resolved, generated: false };
  }

  // Priority 3: Auto-generate
  const generated = generateStrongAPIKey();
  return { key: generated, generated: true };
}

// ─── Default Config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  listening_port: 11411,
  llmrouter_api_key: '',
  aliases: {},
  backends: [
    {
      name: 'openai',
      base_url: 'https://api.openai.com',
      prefix: 'openai/',
      default: true,
      require_api_key: true,
    },
  ],
};

// ─── Main Config Loading ──────────────────────────────────────────────────────

export function loadConfig(): RuntimeConfig {
  // 1. Parse CLI arguments
  const cli = parseCommandLine();

  // 2. Load .env file
  dotenv.config();

  // 3. Create logger (early, for config loading logs)
  const logger = createLogger({ level: cli.logLevel });

  // 4. Load config file
  const rawConfig = loadConfigFile(cli.config);

  let config: Config;
  if (rawConfig) {
    logger.info('Config file loaded', { file: cli.config });
    config = validateConfig(rawConfig);
  } else {
    logger.warn('Config file not found, using default configuration', { file: cli.config });
    config = validateConfig(DEFAULT_CONFIG);
  }

  // 5. Apply CLI overrides
  if (cli.port !== undefined) {
    config.listening_port = cli.port;
    logger.info('Listening port override applied', { port: cli.port });
  }

  // 6. Resolve API key
  const { key, generated } = resolveApiKey(config, cli.llmrouterApiKey);

  if (generated) {
    console.log(`
Your LLM-Router endpoint will be exposed publicly so that Cursor's servers can invoke it.
A strong API key is highly recommended to prevent others from consuming your resources.

You may specify the API key via:
- Config file: set "llmrouter_api_key" in config.json (direct value)
- Config file: set "llmrouter_api_key" to "\${env:YOUR_ENV_VAR}" to read from environment
- Command line flag: --llmrouter-api-key=your_api_key

Since none was provided, a random key has been generated for this session:
${key}

This is what you should set as your API key in Cursor.
`);
  }

  // 7. Build RuntimeConfig
  return {
    ...config,
    llmrouterApiKey: key,
    useGeneratedKey: generated,
    logger,
  };
}

export type { RuntimeConfig } from '../types';
export { ConfigSchema, BackendConfigSchema } from '../types';
