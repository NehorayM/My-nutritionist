import { openDatabase } from '@/lib/idb'
import { runLocal } from './core'

/**
 * Small key/value records in the `meta` store (sync cursors, migration flags).
 * Values are returned as `unknown`: callers validate them (e.g. with a Zod schema).
 * Use `userMetaKey(userId, name)` from `@/lib/idb` for per-user keys so `clearUserData` removes them.
 */
export function readMeta(key: string): Promise<unknown> {
  return runLocal('meta.read', async () => {
    const db = await openDatabase()
    const record = await db.get('meta', key)
    return record === undefined ? undefined : record.value
  })
}

export function writeMeta(key: string, value: unknown): Promise<void> {
  return runLocal('meta.write', async () => {
    const db = await openDatabase()
    await db.put('meta', { key, value })
  })
}

export function deleteMeta(key: string): Promise<void> {
  return runLocal('meta.delete', async () => {
    const db = await openDatabase()
    await db.delete('meta', key)
  })
}
