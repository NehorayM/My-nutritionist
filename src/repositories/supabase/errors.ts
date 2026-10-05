import { isAuthError, isAuthRetryableFetchError } from '@/lib/authErrorGuards'
import { RepositoryError } from '@/repositories/types'

/**
 * Error classification for Supabase calls. The sync layer queues and retries `retryable` errors
 * (network, timeouts, 408/429/5xx) and marks the rest `failed` (validation, RLS, constraints).
 * Messages are built from the operation name, kind and code only — never from server messages or
 * `details`, which can contain row values.
 */
export const REMOTE_ERROR_KINDS = [
  'network',
  'timeout',
  'rate_limited',
  'server',
  'auth',
  'permission',
  'conflict',
  'invalid',
  'not_found',
  'unknown',
] as const
export type RemoteErrorKind = (typeof REMOTE_ERROR_KINDS)[number]

const DESCRIPTIONS: Record<RemoteErrorKind, string> = {
  network: 'the server could not be reached',
  timeout: 'the request timed out',
  rate_limited: 'too many requests',
  server: 'the server had a temporary problem',
  auth: 'the session is not valid',
  permission: 'permission denied',
  conflict: 'the record conflicts with existing data',
  invalid: 'the record was rejected as invalid',
  not_found: 'the record or table was not found',
  unknown: 'unexpected error',
}

const RETRYABLE_KINDS: ReadonlySet<RemoteErrorKind> = new Set(['network', 'timeout', 'rate_limited', 'server'])

export interface ErrorClassification {
  kind: RemoteErrorKind
  retryable: boolean
  /** PostgREST / Postgres / Auth error code when one was provided. */
  code: string | null
  /** HTTP status when known (0 = no response). */
  status: number | null
}

export class SupabaseRepositoryError extends RepositoryError {
  readonly kind: RemoteErrorKind
  readonly code: string | null
  readonly status: number | null

  constructor(message: string, classification: ErrorClassification, cause: unknown) {
    super(message, { retryable: classification.retryable, cause })
    this.name = 'SupabaseRepositoryError'
    this.kind = classification.kind
    this.code = classification.code
    this.status = classification.status
  }
}

function field(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null ? Reflect.get(error, key) : undefined
}

function stringField(error: unknown, key: string): string | null {
  const value = field(error, key)
  return typeof value === 'string' && value !== '' ? value : null
}

function kindForStatus(status: number): RemoteErrorKind | null {
  if (status === 408) return 'timeout'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server'
  if (status === 401) return 'auth'
  if (status === 403) return 'permission'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  return null
}

/** Postgres SQLSTATE / PostgREST code → kind (used when the HTTP status alone is not decisive). */
function kindForCode(code: string): RemoteErrorKind {
  if (code === '42501') return 'permission'
  if (code === '23505' || code === '23503' || code === '23P01') return 'conflict'
  if (code.startsWith('23') || code.startsWith('22')) return 'invalid'
  if (code === '42P01' || code === 'PGRST116' || code === 'PGRST205') return 'not_found'
  if (/^PGRST00[0-3]$/.test(code) || /^(08|53|57)/.test(code) || code === '40001' || code === '40P01') return 'server'
  if (code.startsWith('PGRST3')) return 'auth'
  if (code.startsWith('PGRST')) return 'invalid'
  return 'unknown'
}

function isAbortLike(name: string | null, message: string | null): boolean {
  if (name === 'AbortError' || name === 'TimeoutError') return true
  return message !== null && /^(AbortError|TimeoutError):/.test(message)
}

/** Browser / Node wording for a fetch that never got a response (Chrome, Firefox, Safari, Node). */
const FETCH_FAILURE = /failed to fetch|networkerror|load failed|fetch failed/i

/** Classifies anything a Supabase call can produce: PostgrestError objects, thrown errors, AuthErrors. */
export function classifyError(error: unknown, httpStatus?: number): ErrorClassification {
  const code = stringField(error, 'code')
  const name = stringField(error, 'name')
  const message = stringField(error, 'message')
  const ownStatus = field(error, 'status')
  const status = httpStatus ?? (typeof ownStatus === 'number' ? ownStatus : null)
  const result = (kind: RemoteErrorKind): ErrorClassification => ({
    kind,
    retryable: RETRYABLE_KINDS.has(kind),
    code,
    status,
  })

  if (isAbortLike(name, message)) return result('timeout')
  if (isAuthRetryableFetchError(error)) return result('network')
  if (isAuthError(error)) {
    const byStatus = status === null ? null : kindForStatus(status)
    return result(byStatus !== null && RETRYABLE_KINDS.has(byStatus) ? byStatus : 'auth')
  }
  // A thrown TypeError is a network failure only when it is fetch's own failure; otherwise it is a bug.
  if (error instanceof TypeError || name === 'TypeError') {
    return result(message !== null && FETCH_FAILURE.test(message) ? 'network' : 'unknown')
  }
  // postgrest-js reports requests that never got a response with status 0 (network down, DNS, CORS).
  if (status === 0) return result('network')
  const byStatus = status === null ? null : kindForStatus(status)
  if (byStatus !== null && (RETRYABLE_KINDS.has(byStatus) || code === null)) return result(byStatus)
  if (code !== null) return result(kindForCode(code))
  if (status !== null && status >= 400) return result('invalid')
  return result('unknown')
}

/** Wraps any error from a Supabase call in a `SupabaseRepositoryError` (RepositoryErrors pass through). */
export function toRepositoryError(error: unknown, operation: string, httpStatus?: number): RepositoryError {
  if (error instanceof RepositoryError) return error
  const classification = classifyError(error, httpStatus)
  const reference = classification.code ?? (classification.status ? `HTTP ${classification.status}` : null)
  const message = `Supabase ${operation} failed: ${DESCRIPTIONS[classification.kind]}${reference ? ` (${reference})` : ''}`
  return new SupabaseRepositoryError(message, classification, error)
}
