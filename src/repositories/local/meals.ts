import { openDatabase, userCompoundRange } from '@/lib/idb'
import type { DateRange, MealRepository } from '@/repositories/types'
import type { MealEntry } from '@/types'
import { checkDateRange, normalizeLimit } from '@/schemas'
import { parseStored, parseStoredList, removeOwned, runLocal, saveOwned, STORE_SPECS } from './core'

const spec = STORE_SPECS.meals

/** Chronological order within a day: date, then logging time, then id (deterministic). */
export function compareMealEntries(a: MealEntry, b: MealEntry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.loggedAt !== b.loggedAt) return a.loggedAt < b.loggedAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

async function listRange(userId: string, range: DateRange): Promise<MealEntry[]> {
  const bounds = checkDateRange(range)
  if (!bounds) return []
  const db = await openDatabase()
  const raw = await db.getAllFromIndex(
    'meals',
    'byUserDate',
    IDBKeyRange.bound([userId, bounds.from], [userId, bounds.to]),
  )
  return parseStoredList(spec, raw, userId).sort(compareMealEntries)
}

/**
 * Newest `loggedAt` first (ties: higher id first). Walks the `[userId, loggedAt]` index backwards and
 * stops after `limit` valid entries, so it stays fast for multi-year logs. `loggedAt` is stored
 * canonicalized to UTC (`toISOString`), so string order equals time order.
 */
async function listRecent(userId: string, limit: number): Promise<MealEntry[]> {
  const max = normalizeLimit(limit)
  if (max === 0) return []
  const db = await openDatabase()
  const tx = db.transaction('meals')
  const entries: MealEntry[] = []
  let cursor = await tx.store.index('byUserLoggedAt').openCursor(userCompoundRange(userId), 'prev')
  while (cursor && entries.length < max) {
    const entry = parseStored(spec, cursor.value, userId)
    if (entry) entries.push(entry)
    cursor = await cursor.continue()
  }
  await tx.done
  return entries
}

export function createLocalMealRepository(userId: string): MealRepository {
  return {
    listByDate: (date) => runLocal('meals.listByDate', () => listRange(userId, { from: date, to: date })),
    listRange: (range) => runLocal('meals.listRange', () => listRange(userId, range)),
    listRecent: (limit) => runLocal('meals.listRecent', () => listRecent(userId, limit)),
    save: (entry) => runLocal('meals.save', () => saveOwned('meals', entry, userId)),
    remove: (id) => runLocal('meals.remove', () => removeOwned('meals', id, userId)),
  }
}
