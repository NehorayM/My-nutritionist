import { create } from 'zustand'
import { createDefaultProfile } from '@/domain/profile'
import { profileSchema } from '@/schemas'
import { getRepositories } from '@/services/runtime'
import type { Profile } from '@/types'
import { userMessageFor } from './errors'
import { registerUserStoreReset } from './registry'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type SaveResult = { ok: true } | { ok: false; message: string }

interface ProfileState {
  profile: Profile | null
  /** False while the profile is an unsaved default (nothing stored yet for this user). */
  persisted: boolean
  status: LoadStatus
  error: string | null
  saving: boolean
  load: () => Promise<void>
  save: (next: Profile) => Promise<SaveResult>
  reset: () => void
}

const initial = { profile: null, persisted: false, status: 'idle' as LoadStatus, error: null, saving: false }

export const useProfileStore = create<ProfileState>()((set, get) => ({
  ...initial,

  async load() {
    set({ status: 'loading', error: null })
    try {
      const repos = getRepositories()
      const stored = await repos.profile.get()
      // A default profile is kept in memory only: persisting it would block importing
      // a guest profile into a brand-new account later.
      const profile = stored ?? createDefaultProfile(repos.userId, new Date().toISOString())
      set({ profile, persisted: stored !== null, status: 'ready' })
    } catch (error) {
      set({ status: 'error', error: userMessageFor(error, 'load your profile') })
    }
  },

  async save(next) {
    const candidate: Profile = { ...next, updatedAt: new Date().toISOString() }
    const parsed = profileSchema.safeParse(candidate)
    if (!parsed.success) {
      return { ok: false, message: 'Some profile values are out of range. Please review the highlighted fields.' }
    }
    const previous = get().profile
    set({ saving: true, profile: candidate })
    try {
      const saved = await getRepositories().profile.save(candidate)
      set({ profile: saved, persisted: true, saving: false })
      return { ok: true }
    } catch (error) {
      set({ profile: previous, saving: false })
      return { ok: false, message: userMessageFor(error, 'save your profile') }
    }
  },

  reset() {
    set(initial)
  },
}))

registerUserStoreReset(() => useProfileStore.getState().reset())
