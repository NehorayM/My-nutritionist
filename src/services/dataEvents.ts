import { logger } from '@/lib/logger'
import { SYNC_ENTITIES, type SyncEntity } from '@/types'

/**
 * "Data of these tables changed for this user" — the signal screens use to reload what they show.
 *
 * Sources:
 * - this tab's writes → OTHER tabs only (`notifyOtherTabs`; this tab already updated its stores optimistically);
 * - another tab's writes → arrive here through a BroadcastChannel;
 * - the server (Realtime notifications, sync conflicts resolved by the server, a returning visible tab)
 *   → this tab (`notifyThisTab`).
 * Messages carry only a user id and table names — never record data.
 */
export interface DataChange {
  userId: string
  entities: SyncEntity[]
}

export interface DataEvents {
  notifyThisTab(change: DataChange): void
  notifyOtherTabs(change: DataChange): void
  subscribe(listener: (change: DataChange) => void): () => void
  dispose(): void
}

/** The subset of BroadcastChannel used here (a fake in tests). */
export interface ChannelLike {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  close(): void
}

export const DATA_CHANNEL_NAME = 'my-nutritionist:data'
const KNOWN = new Set<string>(SYNC_ENTITIES)

function openChannel(): ChannelLike | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(DATA_CHANNEL_NAME)
  } catch {
    return null
  }
}

/** Accepts only well-formed messages: a string user id and known table names. */
export function parseDataChange(value: unknown): DataChange | null {
  if (typeof value !== 'object' || value === null) return null
  const userId: unknown = Reflect.get(value, 'userId')
  const entities: unknown = Reflect.get(value, 'entities')
  if (typeof userId !== 'string' || !Array.isArray(entities)) return null
  const known = entities.filter((entity): entity is SyncEntity => typeof entity === 'string' && KNOWN.has(entity))
  return known.length > 0 ? { userId, entities: known } : null
}

export function createDataEvents(channel: ChannelLike | null = openChannel()): DataEvents {
  const listeners = new Set<(change: DataChange) => void>()
  const emit = (change: DataChange): void => {
    for (const listener of [...listeners]) {
      try {
        listener(change)
      } catch (error) {
        logger.error('data-events', 'A listener failed', error)
      }
    }
  }
  const onMessage = (event: MessageEvent): void => {
    const change = parseDataChange(event.data)
    if (change) emit(change)
  }
  channel?.addEventListener('message', onMessage)

  return {
    notifyThisTab: (change) => {
      if (change.entities.length > 0) emit(change)
    },
    notifyOtherTabs: (change) => {
      if (change.entities.length === 0 || !channel) return
      try {
        channel.postMessage({ userId: change.userId, entities: change.entities })
      } catch (error) {
        logger.warn('data-events', 'Could not notify other tabs', error)
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose: () => {
      channel?.removeEventListener('message', onMessage)
      channel?.close()
      listeners.clear()
    },
  }
}

let shared: DataEvents | null = null

/** The app-wide instance (one BroadcastChannel per tab). */
export function dataEvents(): DataEvents {
  shared ??= createDataEvents()
  return shared
}
