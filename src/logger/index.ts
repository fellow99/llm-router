import winston from 'winston';

/**
 * Options for creating a logger instance.
 */
export interface LoggerOptions {
  /** Log level: debug, info, warn, error */
  level?: string;
}

/**
 * Creates a Winston logger instance with structured JSON output.
 *
 * Log level priority (from most to least verbose):
 *   debug > info > warn > error
 *
 * Default level: 'warn' (or LOG_LEVEL env var)
 *
 * Output format: JSON with timestamp, level, message, and custom fields.
 * Console transport uses colorize + simple format for readability.
 */
export function createLogger(options: LoggerOptions = {}): winston.Logger {
  const level = options.level || process.env.LOG_LEVEL || 'info';

  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: { service: 'llm-router' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),
    ],
  });
}

/**
 * Creates a child logger with default context fields.
 * All log messages from the child logger will include the provided fields.
 *
 * Example:
 *   const proxyLogger = createChildLogger(logger, { module: 'proxy' });
 *   proxyLogger.info('Request proxied'); // includes module: 'proxy'
 */
export function createChildLogger(
  parent: winston.Logger,
  defaultFields: Record<string, unknown>,
): winston.Logger {
  return parent.child(defaultFields);
}
