import { IncomingMessage } from 'http';
import { Readable } from 'stream';

/**
 * Reads the entire body from a Readable stream and returns it as a Buffer.
 */
export async function drainBody(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export interface RecordedResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  truncated: boolean;
}

const MAX_RECORD_SIZE = 1024 * 1024; // 1MB

/**
 * Records the full HTTP response for logging purposes.
 * Non-streaming: full capture. Streaming: limit 1MB with truncation marker.
 */
export async function recordResponse(res: IncomingMessage): Promise<RecordedResponse> {
  const body = await drainBody(res);
  const truncated = body.length > MAX_RECORD_SIZE;
  return {
    statusCode: res.statusCode || 0,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: truncated
      ? body.slice(0, MAX_RECORD_SIZE).toString() + '[TRUNCATED]'
      : body.toString(),
    truncated,
  };
}

/**
 * Reassembles SSE data lines into a readable format for logging.
 * Multiple "data: {...}" lines are combined into readable JSON.
 */
export function reassembleSSE(rawBody: string): string {
  const lines = rawBody.split('\n');
  const dataLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      dataLines.push(trimmed.slice(6));
    }
  }
  return dataLines.join('\n');
}

/**
 * Attempts to format a string as pretty-printed JSON.
 * Falls back to the raw string if not valid JSON.
 */
export function formatJSON(data: string): string {
  try {
    const parsed = JSON.parse(data);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return data;
  }
}
