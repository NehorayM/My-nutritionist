import { create } from 'zustand'
import { createDefaultPlannerSettings } from '@/domain/planner'
import { newId } from '@/lib/id'
import { pantryItemSchema, plannerSettingsSchema } from '@/schemas'
import { getRepositories } from '@/services/runtime'
import type { PantryItem, PlannerSettings } from '@/types'
import { createChangeJournal } from './changeJournal'
import { userMessageFor } from './errors'
import type { LoadStatus, SaveResult } from './profileStore'
import { registerUserStoreReset, sessionGuard } from './registry'

/** What the user enters for a pantry item (ids, owner and timestamps are filled in by the store). */
export type PantryInput = Pick<PantryItem, 'food' | 'grams' | 'servingLabel' | 'servingGrams' | 'prep' | 'cookMinutes' | 'methods' | 'useBy'>
export type KitchenResult<T> = { ok: true; value: T } | { ok: false; message: string }

interface KitchenState {
  /** Newest first. */
  pantry: PantryItem[]
  /** Planner constraints; app defaults until the user saves their own. */
  settings: PlannerSettings | null
  status: LoadStatus
  error: string | null
  load: (options?: { force?: boolean }) => Promise<void>
  addItem: (input: PantryInput) => Promise<KitchenResult<PantryItem>>
  updateItem: (id: string, input: PantryInput) => Promise<KitchenResult<PantryItem>>
  /** Returns the removed item (for Undo). */
  removeItem: (id: string) => Promise<KitchenResult<PantryItem>>
  restoreItem: (item: PantryItem) => Promise<SaveResult>
  /** Takes eaten amounts out of tracked items (removing what is used up). */
  consume: (usage: Readonly<Record<string, number>>) => Promise<SaveResult>
  saveSettings: (next: PlannerSettings) => Promise<SaveResult>
  refresh: () => Promise<void>
  reset: () => void
}

const initial = { pantry: [] as PantryItem[], settings: null, status: 'idle' as LoadStatus, error: null }
const journal = createChangeJournal<PantryItem>()
const INVALID = 'Please check the amount, preparation and date.'
/** Amounts below this many grams count as used up. */
const USED_UP_GRAMS = 5

/** Bumped by every settings save: a load that started before it keeps the saved settings. */
let settingsSaves = 0

const newestFirst = (a: PantryItem, b: PantryItem) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)

export const useKitchenStore = create<KitchenState>()((set, get) => {
  function place(id: string, item: PantryItem | null): void {
    journal.record(id, item)
    const rest = get().pantry.filter((existing) => existing.id !== id)
    set({ pantry: (item ? [...rest, item] : rest).sort(newestFirst) })
  }

  async function persist(item: PantryItem, action: string): Promise<KitchenResult<PantryItem>> {
    if (!pantryItemSchema.safeParse(item).success) return { ok: false, message: INVALID }
    const current = sessionGuard()
    const before = get().pantry.find((existing) => existing.id === item.id) ?? null
    place(item.id, item)
    try {
      const saved = await getRepositories().pantry.save(item)
      if (current()) place(saved.id, saved)
      return { ok: true, value: saved }
    } catch (error) {
      if (current()) place(item.id, before)
      return { ok: false, message: userMessageFor(error, action) }
    }
  }

  async function remove(id: string, action: string): Promise<KitchenResult<PantryItem>> {
    const before = get().pantry.find((existing) => existing.id === id)
    if (!before) return { ok: false, message: 'This item is no longer in your kitchen.' }
    const current = sessionGuard()
    place(id, null)
    try {
      await getRepositories().pantry.remove(id)
      return { ok: true, value: before }
    } catch (error) {
      if (current()) place(id, before)
      return { ok: false, message: userMessageFor(error, action) }
    }
  }

  return {
    ...initial,

    async load(options = {}) {
      const { status } = get()
      if (!options.force && (status === 'ready' || status === 'loading')) return
      const current = sessionGuard()
      set({ status: 'loading', error: null })
      const mark = journal.mark()
      const savesBefore = settingsSaves
      try {
        const repos = getRepositories()
        const [pantry, stored] = await Promise.all([repos.pantry.list(), repos.plannerSettings.get()])
        if (!current()) return
        const kept = settingsSaves !== savesBefore ? get().settings : null
        const settings = kept ?? stored ?? get().settings ?? createDefaultPlannerSettings(repos.userId, new Date().toISOString())
        set({ pantry: journal.overlay(pantry, mark).sort(newestFirst), settings, status: 'ready' })
      } catch (error) {
        const message = userMessageFor(error, 'load your kitchen')
        if (current()) set({ status: 'error', error: message })
      }
    },

    addItem(input) {
      const now = new Date().toISOString()
      return persist({ ...input, id: newId(), userId: getRepositories().userId, createdAt: now, updatedAt: now }, 'add the item')
    },

    async updateItem(id, input) {
      const existing = get().pantry.find((item) => item.id === id)
      if (!existing) return { ok: false, message: 'This item is no longer in your kitchen.' }
      return persist({ ...existing, ...input, updatedAt: new Date().toISOString() }, 'update the item')
    },

    removeItem: (id) => remove(id, 'remove the item'),

    async restoreItem(item) {
      const result = await persist({ ...item, updatedAt: new Date().toISOString() }, 'restore the item')
      return result.ok ? { ok: true } : result
    },

    async consume(usage) {
      for (const [id, grams] of Object.entries(usage)) {
        const item = get().pantry.find((existing) => existing.id === id)
        if (!item || item.grams === null || grams <= 0) continue
        const left = Math.round((item.grams - grams) * 10) / 10
        const result = left < USED_UP_GRAMS ? await remove(id, 'update your kitchen') : await persist({ ...item, grams: left, updatedAt: new Date().toISOString() }, 'update your kitchen')
        if (!result.ok) return result
      }
      return { ok: true }
    },

    async saveSettings(next) {
      const candidate: PlannerSettings = { ...next, updatedAt: new Date().toISOString() }
      if (!plannerSettingsSchema.safeParse(candidate).success) return { ok: false, message: 'Please check the calorie limits and times.' }
      const current = sessionGuard()
      const previous = get().settings
      settingsSaves += 1
      set({ settings: candidate })
      try {
        const saved = await getRepositories().plannerSettings.save(candidate)
        if (current()) set({ settings: saved })
        return { ok: true }
      } catch (error) {
        if (current() && get().settings === candidate) set({ settings: previous })
        return { ok: false, message: userMessageFor(error, 'save your planner settings') }
      }
    },

    async refresh() {
      if (get().status !== 'idle') await get().load({ force: true })
    },

    reset() {
      journal.clear()
      set(initial)
    },
  }
})

registerUserStoreReset(() => useKitchenStore.getState().reset())
