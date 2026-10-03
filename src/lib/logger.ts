/**
 * Minimal diagnostic logger. Never pass secrets, tokens, emails or full records:
 * log an operation name and a short error description only.
 */
type Level = 'debug' | 'info' | 'warn' | 'error'

const SENSITIVE_PATTERN = /(sb_(secret|publishable)_[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+|[\w.+-]+@[\w-]+\.[\w.]+)/g

export function redact(text: string): string {
  return text.replace(SENSITIVE_PATTERN, '[redacted]')
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return redact(`${error.name}: ${error.message}`)
  if (typeof error === 'string') return redact(error)
  return 'Unknown error'
}

function write(level: Level, scope: string, message: string, error?: unknown): void {
  if (import.meta.env.MODE === 'test') return
  if (level === 'debug' && !import.meta.env.DEV) return
  const line = `[${scope}] ${redact(message)}${error === undefined ? '' : ` — ${describeError(error)}`}`
  console[level](line)
}

export const logger = {
  debug: (scope: string, message: string) => write('debug', scope, message),
  info: (scope: string, message: string) => write('info', scope, message),
  warn: (scope: string, message: string, error?: unknown) => write('warn', scope, message, error),
  error: (scope: string, message: string, error?: unknown) => write('error', scope, message, error),
}
