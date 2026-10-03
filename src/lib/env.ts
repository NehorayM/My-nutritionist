/**
 * Browser-safe Supabase configuration read from Vite env vars.
 * Only the project URL and the publishable (or legacy anon) key may ever be used here.
 * Secret / service-role keys are rejected so they can never be used from the browser.
 */
export type SupabaseConfig =
  | { configured: true; url: string; key: string }
  | { configured: false; reason: 'missing' | 'invalid_url' | 'forbidden_key' }

export interface SupabaseEnvInput {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Legacy anon JWT key, accepted for older projects. */
  VITE_SUPABASE_ANON_KEY?: string
}

function decodeJwtRole(token: string): string | null {
  const segment = token.split('.')[1]
  if (!segment) return null
  try {
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'))
    const payload: unknown = JSON.parse(json)
    if (payload && typeof payload === 'object' && 'role' in payload && typeof payload.role === 'string') {
      return payload.role
    }
    return null
  } catch {
    return null
  }
}

/** True for keys that must never reach a browser (secret keys, service_role JWTs). */
export function isForbiddenBrowserKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  return decodeJwtRole(key) === 'service_role'
}

export function readSupabaseConfig(env: SupabaseEnvInput): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !key) return { configured: false, reason: 'missing' }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { configured: false, reason: 'invalid_url' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { configured: false, reason: 'invalid_url' }
  if (isForbiddenBrowserKey(key)) return { configured: false, reason: 'forbidden_key' }
  return { configured: true, url: parsed.origin, key }
}
