import { z, ZodError } from 'zod';
import { Logger } from 'winston';

// ─── Backend Configuration Schema ────────────────────────────────────────────

export const BackendConfigSchema = z.object({
  name: z.string().min(1, "Backend name is required"),
  base_url: z.string().url("Invalid backend URL format"),
  prefix: z.string().min(1, "Backend prefix is required"),
  default: z.boolean().default(false),
  require_api_key: z.boolean().default(false),
  key_env_var: z.string().default(""),
  role_rewrites: z.record(z.string(), z.string()).default({}),
  unsupported_params: z.array(z.string()).default([]),
});

// ─── Configuration Schema ────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  listening_port: z.number().int().positive().default(11411),
  llmrouter_api_key_env: z.string().default("LLMROUTER_API_KEY"),
  aliases: z.record(z.string(), z.string()).default({}),
  backends: z.array(BackendConfigSchema).min(1, "At least one backend is required"),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type BackendConfig = z.infer<typeof BackendConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

// ─── Runtime Configuration ───────────────────────────────────────────────────

export interface RuntimeConfig extends Config {
  llmrouterApiKey: string;    // Resolved API key from env or auto-generated
  useGeneratedKey: boolean;   // Whether key was auto-generated
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
