import { create } from 'zustand'
import { dailyWeightsThrough } from '@/domain/weight'
import { newId } from '@/lib/id'
import { weightEntrySchema } from '@/schemas'
import { getRepositories } from '@/services/runtime'
import type { WeightEntry, WeightUnit } from '@/types'
import { userMessageFor } from './errors'
import { createChangeJournal } from './changeJournal'
import type { LoadStatus, SaveResult } from './profileStore'
import { registerUserStoreReset, sessionGuard } from './registry'

export interface WeighInInput {
  weightKg: number
  inputUnit: WeightUnit
  /** Local date key of the measurement. */
  date: string
  /** ISO timestamp of the measurement. */
  measuredAt: string
  note: string | null
}

interface WeightState {
  entries: WeightEntry[]
  status: LoadStatus
  error: string | null
  load: () => Promise<void>
  add: (input: WeighInInput) => Promise<SaveResult>
  update: (entry: WeightEntry) => Promise<SaveResult>
  remove: (id: string) => Promise<SaveResult>
  /** Re-saves a previously removed entry (undo). */
  restore: (entry: WeightEntry) => Promise<SaveResult>
  /** Reloads when already loaded (data changed elsewhere). */
  refresh: () => Promise<void>
  reset: () => void
}

const initial = { entries: [] as WeightEntry[], status: 'idle' as LoadStatus, error: null }
/** Local changes, re-applied to loads that started before them (see `ChangeJournal`). */
const journal = createChangeJournal<WeightEntry>()

function invalid(): SaveResult {
  return { ok: false, message: 'Please enter a weight between 20 and 400 kg (44–880 lb).' }
}

export const useWeightStore = create<WeightState>()((set, get) => {
  /** Replaces (or, with null, removes) one entry; other entries — e.g. a concurrent save — are untouched. */
  function place(id: string, entry: WeightEntry | null): void {
    journal.record(id, entry)
    const rest = get().entries.filter((e) => e.id !== id)
    set({ entries: entry ? [...rest, entry] : rest })
  }

  async function persist(entry: WeightEntry, action: string): Promise<SaveResult> {
    if (!weightEntrySchema.safeParse(entry).success) return invalid()
    const current = sessionGuard()
    const before = get().entries.find((e) => e.id === entry.id) ?? null
    place(entry.id, entry)
    try {
      const saved = await getRepositories().weights.save(entry)
      if (current()) place(saved.id, saved)
      return { ok: true }
    } catch (error) {
      if (current()) place(entry.id, before)
      return { ok: false, message: userMessageFor(error, action) }
    }
  }

  return {
    ...initial,

    async load() {
      const current = sessionGuard()
      set({ status: 'loading', error: null })
      const mark = journal.mark()
      try {
        const loaded = await getRepositories().weights.list()
        if (current()) set({ entries: journal.overlay(loaded, mark), status: 'ready' })
      } catch (error) {
        const message = userMessageFor(error, 'load your weigh-ins')
        if (current()) set({ status: 'error', error: message })
      }
    },

    add(input) {
      const now = new Date().toISOString()
      const entry: WeightEntry = {
        id: newId(),
        userId: getRepositories().userId,
        date: input.date,
        measuredAt: input.measuredAt,
        weightKg: Math.round(input.weightKg * 100) / 100,
        inputUnit: input.inputUnit,
        note: input.note,
        createdAt: now,
        updatedAt: now,
      }
      return persist(entry, 'save your weigh-in')
    },

    update(entry) {
      return persist({ ...entry, updatedAt: new Date().toISOString() }, 'update the weigh-in')
    },

    restore(entry) {
      return persist({ ...entry, updatedAt: new Date().toISOString() }, 'restore the weigh-in')
    },

    async remove(id) {
      const before = get().entries.find((e) => e.id === id) ?? null
      const current = sessionGuard()
      place(id, null)
      try {
        await getRepositories().weights.remove(id)
        return { ok: true }
      } catch (error) {
        if (current()) place(id, before)
        return { ok: false, message: userMessageFor(error, 'delete the weigh-in') }
      }
    },

    async refresh() {
      if (get().status !== 'idle') await get().load()
    },

    reset() {
      journal.clear()
      set(initial)
    },
  }
})

registerUserStoreReset(() => useWeightStore.getState().reset())

/** Latest daily weight (same-day rule from the weight engine) up to `today`, or null. */
export function latestWeightKg(entries: readonly WeightEntry[], today: string): number | null {
  return dailyWeightsThrough(entries, today).at(-1)?.weightKg ?? null
}
