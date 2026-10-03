import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readSupabaseConfig, type SupabaseConfig } from './env'
import { logger } from './logger'

/**
 * Supabase client wrapper. Contains NO data-access logic (see src/repositories/supabase).
 * Missing configuration is a normal state (Offline/Local mode), never a startup error.
 */
export const supabaseConfig: SupabaseConfig = readSupabaseConfig(import.meta.env)

if (!supabaseConfig.configured && supabaseConfig.reason === 'forbidden_key') {
  logger.error('supabase', 'A secret/service-role key was supplied to the browser build and was ignored. Use the publishable key.')
} else if (!supabaseConfig.configured && supabaseConfig.reason === 'invalid_url') {
  logger.warn('supabase', 'VITE_SUPABASE_URL is not a valid http(s) URL; running in Offline/Local mode.')
}

let client: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return supabaseConfig.configured
}

/** Shared client, or null when Supabase is not configured. Never throws for missing config. */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfig.configured) return null
  client ??= createClient(supabaseConfig.url, supabaseConfig.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
  return client
}
