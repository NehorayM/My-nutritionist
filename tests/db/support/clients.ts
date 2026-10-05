import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { TestUser } from './context.ts'
import type { LocalStackEnv } from './localStack.ts'

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const

/** Publishable key, no session → Postgres role `anon` (exactly what a signed-out browser gets). */
export function createAnonClient(env: LocalStackEnv): SupabaseClient {
  return createClient(env.apiUrl, env.publishableKey, { auth: NO_SESSION })
}

/** Publishable key + the user's session JWT → Postgres role `authenticated`, auth.uid() = user.id. */
export function createUserClient(env: LocalStackEnv, user: TestUser): SupabaseClient {
  return createClient(env.apiUrl, env.publishableKey, { accessToken: async () => user.accessToken })
}

/** Secret key → `service_role` (bypasses RLS). Used only to arrange/inspect data and manage test users. */
export function createAdminClient(env: LocalStackEnv): SupabaseClient {
  return createClient(env.apiUrl, env.secretKey, { auth: NO_SESSION })
}
