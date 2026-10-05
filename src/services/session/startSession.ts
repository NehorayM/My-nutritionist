import { session } from './index'

let started: Promise<void> | null = null

/** Called once by the session gate: guest mode without Supabase, otherwise restore/ask for an account. */
export function startSession(): Promise<void> {
  started ??= session().start()
  return started
}
