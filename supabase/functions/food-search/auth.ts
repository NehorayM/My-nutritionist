/**
 * Caller authentication for `food-search`: only signed-in Supabase users may spend the shared USDA quota.
 *
 * The user's session JWT arrives as `Authorization: Bearer <jwt>` (added by `supabase.functions.invoke`).
 * It is verified with supabase-js `auth.getClaims(jwt)`: with asymmetric signing keys the signature is checked
 * locally against the project's JWKS (cached per isolate); legacy HS256 projects fall back to an Auth server
 * round-trip. A publishable/secret API key in the header is NOT a user and is rejected.
 */
import { createClient } from '@supabase/supabase-js'

/** Resolves the caller's user id, or null when the request is not from a signed-in (non-anonymous) user. */
export type VerifyUser = (authorization: string | null) => Promise<string | null>

export interface ClaimsResult {
  data: { claims: object } | null
  error: unknown
}

export interface ClaimsVerifier {
  getClaims: (jwt: string) => Promise<ClaimsResult>
}

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

/** The token of a `Bearer <jwt>` header; null when absent or not JWT-shaped (e.g. an sb_publishable_ key). */
export function bearerToken(authorization: string | null): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? '')
  const token = match?.[1]
  return token !== undefined && JWT_SHAPE.test(token) ? token : null
}

function claim(claims: object, key: string): unknown {
  return (claims as Record<string, unknown>)[key]
}

export function createUserVerifier(verifier: ClaimsVerifier, onError?: (error: unknown) => void): VerifyUser {
  return async (authorization) => {
    const token = bearerToken(authorization)
    if (token === null) return null
    try {
      const { data, error } = await verifier.getClaims(token)
      if (error || !data) return null
      const sub = claim(data.claims, 'sub')
      const role = claim(data.claims, 'role')
      if (role !== 'authenticated' || typeof sub !== 'string' || sub.length === 0) return null
      if (claim(data.claims, 'is_anonymous') === true) return null
      return sub
    } catch (error) {
      onError?.(error)
      return null
    }
  }
}

/** supabase-js client used only to verify user JWTs (no session storage, no refresh timers). */
export function createSupabaseClaimsVerifier(supabaseUrl: string, publishableKey: string): ClaimsVerifier {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { getClaims: (jwt) => client.auth.getClaims(jwt) }
}
