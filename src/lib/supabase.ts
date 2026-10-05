import type { SupabaseClient } from '@supabase/supabase-js'
import { readSupabaseConfig, type SupabaseConfig } from './env'
import { logger } from './logger'

/**
 * Supabase client wrapper. Contains NO data-access logic (see src/repositories/supabase).
 * Missing configuration is a normal state (Offline/Local mode), never a startup error.
 * supabase-js is loaded on demand, so Offline/Local mode never downloads it.
 */
export const supabaseConfig: SupabaseConfig = readSupabaseConfig(import.meta.env)

if (!supabaseConfig.configured && supabaseConfig.reason === 'forbidden_key') {
  logger.error('supabase', 'A secret/service-role key was supplied to the browser build and was ignored. Use the publishable key.')
} else if (!supabaseConfig.configured && supabaseConfig.reason === 'invalid_url') {
  logger.warn('supabase', 'VITE_SUPABASE_URL is not a valid http(s) URL; running in Offline/Local mode.')
}

let client: SupabaseClient | null = null
let loading: Promise<SupabaseClient | null> | null = null

export function isSupabaseConfigured(): boolean {
  return supabaseConfig.configured
}

/**
 * Loads supabase-js and creates the shared client (once). Resolves null when Supabase is not configured
 * or the library could not be loaded — the app then runs in Offline/Local mode.
 */
export function loadSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfig.configured) return Promise.resolve(null)
  const { url, key } = supabaseConfig
  loading ??= import('@supabase/supabase-js').then(
    ({ createClient }) => {
      client = createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      })
      return client
    },
    (error: unknown) => {
      logger.error('supabase', 'Could not load the Supabase client; continuing in Offline/Local mode', error)
      loading = null
      return null
    },
  )
  return loading
}

/** The shared client once `loadSupabase()` has resolved; null before that or without configuration. */
export function getSupabase(): SupabaseClient | null {
  return client
}
