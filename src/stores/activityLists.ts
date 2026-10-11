import { compareDateKeys } from '@/domain/dates'
import type { DateRange } from '@/repositories/types'
import type { ChangeJournal } from './changeJournal'
import { userMessageFor } from './errors'
import { sessionGuard } from './registry'

/** Optimistic list updates shared by the activity store's two lists (workouts, scheduled sessions). */
export type Dated = { id: string; date: string; createdAt: string; updatedAt: string }
export type Saved<T> = { ok: true; entry: T } | { ok: false; message: string }

/** One loaded list (workouts or scheduled sessions) and how its records are checked, saved and ordered. */
export interface ListSpec<T extends Dated> {
  list: () => T[]
  apply: (list: T[]) => void
  save: (record: T) => Promise<T>
  valid: (record: T) => boolean
  range: () => DateRange | undefined
  order: (a: T, b: T) => number
  invalid: string
  /** Local changes, re-applied to loads that started before them. */
  journal: ChangeJournal<T>
}

export const byDate = (a: Dated, b: Dated) => compareDateKeys(a.date, b.date) || a.createdAt.localeCompare(b.createdAt)
export const touch = <T extends Dated>(record: T): T => ({ ...record, updatedAt: new Date().toISOString() })
export const inRange = (date: string, range?: DateRange) => !range || (date >= range.from && date <= range.to)

/** Replaces the record with `id` by `item` (dropping it when `item` is null or outside the loaded range). */
export function replace<T extends Dated>(spec: ListSpec<T>, id: string, item: T | null): void {
  spec.journal.record(id, item)
  const rest = spec.list().filter((existing) => existing.id !== id)
  spec.apply((item && inRange(item.date, spec.range()) ? [...rest, item] : rest).sort(spec.order))
}

/** Optimistic upsert with rollback of just this record on failure (results of an ended session are dropped). */
export async function persist<T extends Dated>(spec: ListSpec<T>, record: T, action: string): Promise<Saved<T>> {
  if (!spec.valid(record)) return { ok: false, message: spec.invalid }
  const current = sessionGuard()
  const before = spec.list().find((existing) => existing.id === record.id) ?? null
  replace(spec, record.id, record)
  try {
    const saved = await spec.save(record)
    if (current()) replace(spec, saved.id, saved)
    return { ok: true, entry: saved }
  } catch (error) {
    if (current()) replace(spec, record.id, before)
    return { ok: false, message: userMessageFor(error, action) }
  }
}
