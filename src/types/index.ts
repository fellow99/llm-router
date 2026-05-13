import { z, ZodError } from 'zod';
import { Logger } from 'winston';

// ─── Backend Configuration Schema ────────────────────────────────────────────

export const BackendConfigSchema = z.object({
  name: z.string().min(1, "Backend name is required"),
  base_url: z.string().url("Invalid backend URL format"),
  prefix: z.string().min(1, "Backend prefix is required"),
  default: z.boolean().default(false),
  disabled: z.boolean().optional().default(false),
  require_api_key: z.boolean().default(false),
  api_key: z.string().default(""),
  role_rewrites: z.record(z.string(), z.string()).default({}),
  unsupported_params: z.array(z.string()).default([]),
});

// ─── Alias Target Schema (weighted routing) ──────────────────────────────────

export const AliasTargetSchema = z.object({
  weight: z.number().positive("Weight must be positive"),
  fallback: z.boolean().optional().default(false),
  disabled: z.boolean().optional().default(false),
});

export type AliasTarget = z.infer<typeof AliasTargetSchema>;

// ─── Alias Value ─────────────────────────────────────────────────────────────

/** A single alias can be a plain string or a weighted multi-backend map */
export type AliasValue = string | Record<string, AliasTarget>;

// ─── Server Configuration Schema ──────────────────────────────────────────────

export const ServerConfigSchema = z.object({
  host: z.string().default(''),
  port: z.string().default(''),
  api_key: z.string().default(''),
});

// ─── Configuration Schema ────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  server: ServerConfigSchema,
  aliases: z.record(
    z.string(),
    z.union([
      z.string(),
      z.record(z.string(), AliasTargetSchema),
    ]),
  ).default({}),
  backends: z.array(BackendConfigSchema).min(1, "At least one backend is required"),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type BackendConfig = z.infer<typeof BackendConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

// ─── Runtime Configuration ───────────────────────────────────────────────────

export interface RuntimeConfig extends Config {
  serverHost: string;          // Resolved server listen host
  serverPort: number;          // Resolved server listen port
  llmrouterApiKey: string;     // Resolved API key from env or auto-generated
  useGeneratedKey: boolean;    // Whether key was auto-generated
  logger: Logger;              // Winston logger instance (import from winston)
}

// ─── Chat Message Interfaces ─────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'developer' | string;
  content: string | null;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

// ─── Error Formatting ────────────────────────────────────────────────────────

export function formatZodError(error: ZodError): string {
  return error.errors.map(err =>
    `  - ${err.path.join('.')}: ${err.message}`
  ).join('\n');
}
