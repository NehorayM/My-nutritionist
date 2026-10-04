import { create } from 'zustand'
import { dailyWeightsThrough } from '@/domain/weight'
import { newId } from '@/lib/id'
import { weightEntrySchema } from '@/schemas'
import { getRepositories } from '@/services/runtime'
import type { WeightEntry, WeightUnit } from '@/types'
import { userMessageFor } from './errors'
import type { LoadStatus, SaveResult } from './profileStore'
import { registerUserStoreReset } from './registry'

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
  reset: () => void
}

const initial = { entries: [] as WeightEntry[], status: 'idle' as LoadStatus, error: null }

function invalid(): SaveResult {
  return { ok: false, message: 'Please enter a weight between 20 and 400 kg (44–880 lb).' }
}

export const useWeightStore = create<WeightState>()((set, get) => {
  async function persist(entry: WeightEntry, action: string): Promise<SaveResult> {
    if (!weightEntrySchema.safeParse(entry).success) return invalid()
    const previous = get().entries
    set({ entries: [...previous.filter((e) => e.id !== entry.id), entry] })
    try {
      const saved = await getRepositories().weights.save(entry)
      set({ entries: [...get().entries.filter((e) => e.id !== saved.id), saved] })
      return { ok: true }
    } catch (error) {
      set({ entries: previous })
      return { ok: false, message: userMessageFor(error, action) }
    }
  }

  return {
    ...initial,

    async load() {
      set({ status: 'loading', error: null })
      try {
        set({ entries: await getRepositories().weights.list(), status: 'ready' })
      } catch (error) {
        set({ status: 'error', error: userMessageFor(error, 'load your weigh-ins') })
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
      const previous = get().entries
      set({ entries: previous.filter((e) => e.id !== id) })
      try {
        await getRepositories().weights.remove(id)
        return { ok: true }
      } catch (error) {
        set({ entries: previous })
        return { ok: false, message: userMessageFor(error, 'delete the weigh-in') }
      }
    },

    reset() {
      set(initial)
    },
  }
})

registerUserStoreReset(() => useWeightStore.getState().reset())

/** Latest daily weight (same-day rule from the weight engine) up to `today`, or null. */
export function latestWeightKg(entries: readonly WeightEntry[], today: string): number | null {
  return dailyWeightsThrough(entries, today).at(-1)?.weightKg ?? null
}
