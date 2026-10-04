import { isSupabaseConfigured } from '@/lib/supabase'
import { useSessionStore } from '@/stores/sessionStore'
import { enterGuestMode } from './sessionController'

let started: Promise<void> | null = null

/**
 * Entry point called once by the session gate. Without Supabase configuration the app runs in
 * Offline/Local (guest) mode immediately.
 */
export function startSession(): Promise<void> {
  started ??= run()
  return started
}

async function run(): Promise<void> {
  if (!isSupabaseConfigured()) {
    await enterGuestMode()
    return
  }
  useSessionStore.setState({ phase: 'welcome' })
}
