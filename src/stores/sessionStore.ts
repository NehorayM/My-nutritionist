import { create } from 'zustand'
import type { AppMode } from '@/types'

/**
 * booting: deciding guest vs account
 * welcome: Supabase is configured, nobody is signed in, and the user hasn't chosen guest mode yet
 * ready:   repositories are set for `userId` and the app is usable
 */
export type SessionPhase = 'booting' | 'welcome' | 'ready'

interface SessionState {
  phase: SessionPhase
  mode: AppMode | null
  /** Owner of all data currently shown (guest id or authenticated user id). */
  userId: string | null
  /** Signed-in account email (cloud mode only). */
  email: string | null
  /** True after a password-recovery link was opened; the UI asks for a new password. */
  passwordRecovery: boolean
}

export const useSessionStore = create<SessionState>()(() => ({
  phase: 'booting',
  mode: null,
  userId: null,
  email: null,
  passwordRecovery: false,
}))
