import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { SYNC_ENTITIES, type SyncEntity } from '@/types'

export interface RemoteChangeListener {
  /** The server says these tables changed (another device or tab wrote them). */
  changed(entities: SyncEntity[]): void
  /** The subscription (re)connected after a gap: changes may have been missed, reload everything. */
  resynced(): void
}

/** Starts listening for the signed-in user's change notifications; returns the unsubscribe function. */
export type RemoteChangeSubscriber = (userId: string, listener: RemoteChangeListener) => () => void

const KNOWN = new Set<string>(SYNC_ENTITIES)

/** Server-only tables shown together with a synchronized one (delivery records belong to the reminders screen). */
const SHOWN_WITH: Readonly<Record<string, SyncEntity>> = { reminder_dispatches: 'reminder_schedules' }

export function changedTable(payload: unknown): SyncEntity | null {
  if (typeof payload !== 'object' || payload === null) return null
  const table: unknown = Reflect.get(payload, 'table')
  if (typeof table !== 'string') return null
  return KNOWN.has(table) ? (table as SyncEntity) : (SHOWN_WITH[table] ?? null)
}

/**
 * Supabase Realtime: the database broadcasts `{ table }` on the private topic `user:<id>` after every write
 * (migration 004); RLS on realtime.messages lets each user join only their own topic.
 */
export function createRealtimeChanges(client: Pick<SupabaseClient, 'channel' | 'removeChannel'>): RemoteChangeSubscriber {
  return (userId, listener) => {
    let subscribedBefore = false
    const channel = client
      .channel(`user:${userId}`, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, (message: { payload?: unknown }) => {
        const table = changedTable(message.payload)
        if (table) listener.changed([table])
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (subscribedBefore) listener.resynced()
          subscribedBefore = true
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.info('realtime', `Change notifications unavailable (${status}); data refreshes on focus and reconnect`)
        }
      })
    return () => {
      void client.removeChannel(channel)
    }
  }
}
