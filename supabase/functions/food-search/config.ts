/**
 * Environment of the `food-search` Edge Function. Values are read through a getter (Deno.env.get in
 * production, a map in tests) and never logged.
 *
 * Supabase provides SUPABASE_URL and the project's API keys to every function: hosted projects expose the
 * new keys as JSON (`SUPABASE_PUBLISHABLE_KEYS` = {"default": "sb_publishable_…"}), the CLI may provide a
 * single `SUPABASE_PUBLISHABLE_KEY`, and older projects only the legacy `SUPABASE_ANON_KEY`.
 * FDC_API_KEY is our own secret: `supabase secrets set FDC_API_KEY=…` (hosted) or supabase/functions/.env (local).
 */
export type EnvGetter = (name: string) => string | undefined

export interface FunctionEnv {
  supabaseUrl: string | null
  publishableKey: string | null
}

function nonEmpty(value: string | undefined): string | null {
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

export function readFunctionEnv(get: EnvGetter): FunctionEnv {
  return { supabaseUrl: nonEmpty(get('SUPABASE_URL')), publishableKey: pickPublishableKey(get) }
}

/** The api.data.gov key for FoodData Central, or null when the secret is not configured. */
export function readFdcApiKey(get: EnvGetter): string | null {
  return nonEmpty(get('FDC_API_KEY'))
}
