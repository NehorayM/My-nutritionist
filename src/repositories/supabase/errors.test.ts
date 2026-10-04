import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { RepositoryError } from '@/repositories/types'
import { classifyError, SupabaseRepositoryError, toRepositoryError, type RemoteErrorKind } from './errors'

/** PostgrestError-shaped object as returned by supabase-js (`{ data: null, error, status }`). */
function pg(code: string, message = 'server message with row values: Apple, 42') {
  return { code, message, details: 'Key (id)=(…) already exists', hint: null }
}

describe('classifyError', () => {
  it.each<[string, unknown, number | undefined, RemoteErrorKind, boolean]>([
    // Requests that never got a response
    ['postgrest network failure (status 0)', { message: 'TypeError: Failed to fetch', code: '' }, 0, 'network', true],
    ['thrown fetch TypeError (Chrome)', new TypeError('Failed to fetch'), undefined, 'network', true],
    ['thrown fetch TypeError (Firefox)', new TypeError('NetworkError when attempting to fetch resource.'), undefined, 'network', true],
    ['thrown fetch TypeError (Safari)', new TypeError('Load failed'), undefined, 'network', true],
    ['thrown programming TypeError', new TypeError('x is not a function'), undefined, 'unknown', false],
    ['AbortError', new DOMException('The operation was aborted.', 'AbortError'), undefined, 'timeout', true],
    ['TimeoutError', new DOMException('signal timed out', 'TimeoutError'), undefined, 'timeout', true],
    ['postgrest abort (status 0)', { message: 'AbortError: The operation was aborted.', code: '' }, 0, 'timeout', true],
    ['postgrest timeout (status 0)', { message: 'TimeoutError: signal timed out', code: '' }, 0, 'timeout', true],
    // HTTP statuses
    ['408', { message: 'timeout' }, 408, 'timeout', true],
    ['429', { message: 'slow down' }, 429, 'rate_limited', true],
    ['500 with SQLSTATE', pg('XX000'), 500, 'server', true],
    ['502 gateway', { message: 'Bad gateway' }, 502, 'server', true],
    ['503 schema cache', pg('PGRST002'), 503, 'server', true],
    ['504 pool timeout', pg('PGRST003'), 504, 'server', true],
    // Non-retryable 4xx
    ['42501 RLS insert denial', pg('42501'), 403, 'permission', false],
    ['42501 missing grant', pg('42501'), 401, 'permission', false],
    ['unique violation', pg('23505'), 409, 'conflict', false],
    ['foreign key violation', pg('23503'), 409, 'conflict', false],
    ['check violation', pg('23514'), 400, 'invalid', false],
    ['not-null violation', pg('23502'), 400, 'invalid', false],
    ['invalid uuid text', pg('22P02'), 400, 'invalid', false],
    ['PGRST bad request', pg('PGRST100'), 400, 'invalid', false],
    ['PGRST204 unknown column', pg('PGRST204'), 400, 'invalid', false],
    ['PGRST205 unknown table', pg('PGRST205'), 404, 'not_found', false],
    ['PGRST116 single row', pg('PGRST116'), 406, 'not_found', false],
    ['undefined table', pg('42P01'), 404, 'not_found', false],
    ['JWT expired', pg('PGRST303'), 401, 'auth', false],
    ['401 without code', { message: 'Unauthorized' }, 401, 'auth', false],
    ['403 without code', { message: 'Forbidden' }, 403, 'permission', false],
    ['other 4xx without code', { message: 'Gone' }, 410, 'invalid', false],
    ['unknown thrown error', new Error('boom'), undefined, 'unknown', false],
    ['non-error value', 'oops', undefined, 'unknown', false],
  ])('%s → %s', (_name, error, status, kind, retryable) => {
    expect(classifyError(error, status)).toMatchObject({ kind, retryable })
  })

  it('classifies auth errors by retryability', () => {
    expect(classifyError(new AuthRetryableFetchError('Failed to fetch', 0))).toMatchObject({ kind: 'network', retryable: true })
    expect(classifyError(new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'))).toMatchObject({
      kind: 'auth',
      retryable: false,
      code: 'refresh_token_not_found',
    })
    expect(classifyError(new AuthApiError('Service unavailable', 503, 'unexpected_failure'))).toMatchObject({
      kind: 'server',
      retryable: true,
    })
    expect(classifyError(new AuthApiError('Too many', 429, 'over_request_rate_limit'))).toMatchObject({
      kind: 'rate_limited',
      retryable: true,
    })
    expect(classifyError(new AuthSessionMissingError())).toMatchObject({ kind: 'auth', retryable: false })
  })

  it('reports the code and status it used', () => {
    expect(classifyError(pg('23505'), 409)).toEqual({ kind: 'conflict', retryable: false, code: '23505', status: 409 })
    expect(classifyError({ status: 503, message: 'x' })).toMatchObject({ status: 503, kind: 'server' })
  })
})

describe('toRepositoryError', () => {
  it('builds messages from operation, kind and code only — never server text or details', () => {
    const error = toRepositoryError(pg('23514'), 'meal_logs.save', 400)
    expect(error).toBeInstanceOf(SupabaseRepositoryError)
    expect(error).toBeInstanceOf(RepositoryError)
    expect(error.message).toBe('Supabase meal_logs.save failed: the record was rejected as invalid (23514)')
    expect(error.message).not.toMatch(/Apple|42|Key/)
    expect(error.retryable).toBe(false)
  })

  it('falls back to the HTTP status as the reference', () => {
    const error = toRepositoryError({ message: 'Service Unavailable' }, 'weight_logs.list', 503)
    expect(error.message).toBe('Supabase weight_logs.list failed: the server had a temporary problem (HTTP 503)')
    expect(error.retryable).toBe(true)
    expect(toRepositoryError(new TypeError('Failed to fetch'), 'favorites.remove').message).toBe(
      'Supabase favorites.remove failed: the server could not be reached',
    )
  })

  it('keeps the original error as cause and exposes kind/code/status', () => {
    const original = pg('42501')
    const error = toRepositoryError(original, 'foods.save', 403)
    expect(error.cause).toBe(original)
    expect(error).toMatchObject({ kind: 'permission', code: '42501', status: 403 })
  })

  it('passes RepositoryErrors through unchanged', () => {
    const existing = new RepositoryError('Invalid meal entry: check grams', { retryable: false })
    expect(toRepositoryError(existing, 'meal_logs.save')).toBe(existing)
  })
})
