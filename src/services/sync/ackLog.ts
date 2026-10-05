/**
 * Remembers which records were acknowledged by the server recently, so a read that fetched server
 * data BEFORE an acknowledgement does not overwrite (or delete) the newer local copy afterwards.
 * Usage: `const mark = log.mark()` before the remote read, `log.since(mark)` when refreshing the cache.
 */
export interface AckLog {
  mark(): number
  record(key: string): void
  /** Record keys acknowledged after `mark`; null when entries that old were already evicted. */
  since(mark: number): ReadonlySet<string> | null
}

export const DEFAULT_ACK_LOG_SIZE = 5_000

export function createAckLog(capacity: number = DEFAULT_ACK_LOG_SIZE): AckLog {
  const entries: { seq: number; key: string }[] = []
  let seq = 0
  let evictedThrough = 0

  return {
    mark: () => seq,
    record(key) {
      seq += 1
      entries.push({ seq, key })
      if (entries.length > capacity) {
        const evicted = entries.splice(0, entries.length - capacity)
        evictedThrough = evicted.at(-1)?.seq ?? evictedThrough
      }
    },
    since(mark) {
      if (mark < evictedThrough) return null
      return new Set(entries.filter((entry) => entry.seq > mark).map((entry) => entry.key))
    },
  }
}
