import type { SupabaseClient } from '@supabase/supabase-js'
import { USER_TABLES, type UserTable } from './rows.ts'

/**
 * Remembers rows created by a test file and deletes them with the admin client afterwards, so files do not
 * leak rows into each other (deleting the users at the end of the run cascades the rest).
 */
export interface Cleanup {
  track: (table: UserTable, id: string) => void
  run: () => Promise<void>
}

export function createCleanup(admin: SupabaseClient): Cleanup {
  const pending = new Map<UserTable, Set<string>>()
  return {
    track(table, id) {
      const ids = pending.get(table) ?? new Set<string>()
      ids.add(id)
      pending.set(table, ids)
    },
    async run() {
      // Children first; food_items before profiles keeps the order readable (FKs cascade either way).
      for (const table of [...USER_TABLES].reverse()) {
        const ids = pending.get(table)
        if (!ids || ids.size === 0) continue
        const { error } = await admin.from(table).delete().in('id', [...ids])
        if (error) throw new Error(`Cleanup of ${table} failed: ${error.message}`)
      }
      pending.clear()
    },
  }
}
