import { loadSupabase } from '@/lib/supabase'
import { initSession } from './index'

let started: Promise<void> | null = null

/**
 * Called once by the session gate: guest mode without Supabase, otherwise restore/ask for an account.
 * The client, the auth service and the auth subscription are created with no macrotask in between, so an
 * auth event like PASSWORD_RECOVERY (emitted by supabase-js via setTimeout) can't be missed.
 */
export function startSession(): Promise<void> {
  started ??= loadSupabase()
    .then(initSession)
    .then((controller) => controller.start())
  return started
}
