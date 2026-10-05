import type { OutboxMutation } from '@/types'
import { recordKey } from './coalesce'

export interface OutboxCounts {
  pending: number
  failed: number
}

/**
 * In-memory view of one user's queue (mutation id → record key + status) so that coalescing and
 * counting stay O(1) while thousands of mutations are queued (e.g. a large guest import).
 * It is a cache: the outbox verifies every id it yields against IndexedDB, rebuilds it from every
 * full listing, and drops it when a transaction fails. A stale entry (another tab changed the
 * queue) can at worst produce two queued mutations for one record, which FIFO flushing applies in
 * order, so the end state stays correct.
 */
export interface OutboxIndex {
  readonly loaded: boolean
  /** Bumped on every change; a listing only rebuilds the index if nothing changed meanwhile. */
  readonly version: number
  rebuild(mutations: readonly OutboxMutation[], expectedVersion: number): void
  set(mutation: OutboxMutation): void
  delete(id: string): void
  invalidate(): void
  idForRecord(key: string): string | undefined
  counts(): OutboxCounts
}

/** Pending/failed counts of a queue listing. */
export function countQueue(mutations: readonly Pick<OutboxMutation, 'status'>[]): OutboxCounts {
  let pending = 0
  let failed = 0
  for (const { status } of mutations) {
    if (status === 'pending') pending += 1
    else failed += 1
  }
  return { pending, failed }
}

interface Entry {
  key: string
  status: OutboxMutation['status']
}

export function createOutboxIndex(): OutboxIndex {
  const byId = new Map<string, Entry>()
  const byRecord = new Map<string, string>()
  let loaded = false
  let version = 0

  const remove = (id: string): void => {
    const entry = byId.get(id)
    if (!entry) return
    byId.delete(id)
    if (byRecord.get(entry.key) === id) byRecord.delete(entry.key)
  }

  return {
    get loaded() {
      return loaded
    },
    get version() {
      return version
    },
    rebuild(mutations, expectedVersion) {
      if (expectedVersion !== version) return
      byId.clear()
      byRecord.clear()
      for (const mutation of mutations) {
        const key = recordKey(mutation.entity, mutation.recordId)
        byId.set(mutation.id, { key, status: mutation.status })
        byRecord.set(key, mutation.id)
      }
      loaded = true
      version += 1
    },
    set(mutation) {
      const key = recordKey(mutation.entity, mutation.recordId)
      const previous = byRecord.get(key)
      if (previous !== undefined && previous !== mutation.id) remove(previous)
      byId.set(mutation.id, { key, status: mutation.status })
      byRecord.set(key, mutation.id)
      version += 1
    },
    delete(id) {
      remove(id)
      version += 1
    },
    invalidate() {
      byId.clear()
      byRecord.clear()
      loaded = false
      version += 1
    },
    idForRecord: (key) => byRecord.get(key),
    counts: () => countQueue([...byId.values()]),
  }
}
