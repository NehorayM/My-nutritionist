/**
 * Environment helpers shared by the Edge Functions. Values are read through a getter (Deno.env.get in
 * production, a map in tests) and never logged.
 *
 * Supabase provides SUPABASE_URL and the project's API keys to every function: hosted projects expose the
 * new keys as JSON (`SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` = {"default": "sb_…"}), the CLI may
 * provide single keys, and older projects only the legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
 */
export type EnvGetter = (name: string) => string | undefined

export function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function fromKeyMap(json: string | null): string | null {
  if (json === null) return null
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const keys = parsed as Record<string, unknown>
    const preferred = keys.default
    if (typeof preferred === 'string' && preferred.trim()) return preferred.trim()
    const first = Object.values(keys).find((value): value is string => typeof value === 'string' && value.trim() !== '')
    return first?.trim() ?? null
  } catch {
    return null
  }
}

export function pickPublishableKey(get: EnvGetter): string | null {
  return (
    fromKeyMap(nonEmpty(get('SUPABASE_PUBLISHABLE_KEYS'))) ??
    nonEmpty(get('SUPABASE_PUBLISHABLE_KEY')) ??
    nonEmpty(get('SUPABASE_ANON_KEY'))
  )
}

/** The project's secret (service role) key: server-side only, never sent to a browser. */
export function pickSecretKey(get: EnvGetter): string | null {
  return (
    fromKeyMap(nonEmpty(get('SUPABASE_SECRET_KEYS'))) ??
    nonEmpty(get('SUPABASE_SECRET_KEY')) ??
    nonEmpty(get('SUPABASE_SERVICE_ROLE_KEY'))
  )
}
