import { create } from 'zustand'
import { createDefaultProfile } from '@/domain/profile'
import { profileSchema } from '@/schemas'
import { getRepositories } from '@/services/runtime'
import type { Profile } from '@/types'
import { userMessageFor } from './errors'
import { registerUserStoreReset, sessionGuard } from './registry'

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
  /** Reloads when already loaded (data changed elsewhere). */
  refresh: () => Promise<void>
  reset: () => void
}

const initial = { profile: null, persisted: false, status: 'idle' as LoadStatus, error: null, saving: false }
/** Bumped by every local save: a load that started before a save keeps the saved profile instead. */
let saves = 0

export const useProfileStore = create<ProfileState>()((set, get) => ({
  ...initial,

  async load() {
    const current = sessionGuard()
    const savesBefore = saves
    set({ status: 'loading', error: null })
    try {
      const repos = getRepositories()
      const stored = await repos.profile.get()
      if (!current()) return
      if (saves !== savesBefore && get().profile) {
        set({ status: 'ready' })
        return
      }
      // A default profile is kept in memory only: persisting it would block importing
      // a guest profile into a brand-new account later.
      const profile = stored ?? createDefaultProfile(repos.userId, new Date().toISOString())
      set({ profile, persisted: stored !== null, status: 'ready' })
    } catch (error) {
      const message = userMessageFor(error, 'load your profile')
      if (current()) set({ status: 'error', error: message })
    }
  },

  async save(next) {
    const candidate: Profile = { ...next, updatedAt: new Date().toISOString() }
    const parsed = profileSchema.safeParse(candidate)
    if (!parsed.success) {
      return { ok: false, message: 'Some profile values are out of range. Please review the highlighted fields.' }
    }
    const current = sessionGuard()
    const previous = get().profile
    saves += 1
    set({ saving: true, profile: candidate })
    try {
      const saved = await getRepositories().profile.save(candidate)
      if (current()) set({ profile: saved, persisted: true, saving: false })
      return { ok: true }
    } catch (error) {
      // Roll back only when no newer save replaced this one meanwhile.
      if (current()) set(get().profile === candidate ? { profile: previous, saving: false } : { saving: false })
      return { ok: false, message: userMessageFor(error, 'save your profile') }
    }
  },

  async refresh() {
    if (get().status !== 'idle') await get().load()
  },

  reset() {
    set(initial)
  },
}))

registerUserStoreReset(() => useProfileStore.getState().reset())
