/**
 * Local changes a store made to one list while a load of that list may be in flight.
 *
 * A load reads the repository, which can take a while (a Supabase round trip). If the user adds,
 * edits or deletes a record meanwhile, the loaded list may predate that change; applying it as is
 * would make the change vanish from the screen although it was saved. Stores therefore take a
 * `mark()` before reading and pass the result through `overlay(list, mark)`, which re-applies every
 * change recorded after the mark, in order.
 */
export interface ChangeJournal<T extends { id: string }> {
  /** Position to pass to `overlay` (take it right before the repository read). */
  mark(): number
  /** Records the latest state of `id`: the record, or null when it was removed. */
  record(id: string, value: T | null): void
  /**
   * `list` with every change after `mark` applied. `belongs` decides whether a changed record is part
   * of this list (e.g. its date is the loaded day); records that no longer belong are removed.
   */
  overlay(list: readonly T[], mark: number, belongs?: (record: T) => boolean): T[]
  /** True when changes were recorded after `mark`. */
  changedSince(mark: number): boolean
  clear(): void
}

/** Enough for any realistic number of edits during one load; older entries are dropped first. */
export const JOURNAL_CAPACITY = 500

export function createChangeJournal<T extends { id: string }>(capacity: number = JOURNAL_CAPACITY): ChangeJournal<T> {
  let seq = 0
  let entries: { seq: number; id: string; value: T | null }[] = []

  return {
    mark: () => seq,
    record(id, value) {
      seq += 1
      entries.push({ seq, id, value })
      if (entries.length > capacity) entries = entries.slice(entries.length - capacity)
    },
    overlay(list, mark, belongs = () => true) {
      const later = entries.filter((entry) => entry.seq > mark)
      if (later.length === 0) return [...list]
      const byId = new Map(list.map((record) => [record.id, record]))
      for (const { id, value } of later) {
        if (value !== null && belongs(value)) byId.set(id, value)
        else byId.delete(id)
      }
      return [...byId.values()]
    },
    changedSince: (mark) => seq > mark,
    clear() {
      entries = []
    },
  }
}
