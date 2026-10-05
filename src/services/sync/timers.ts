/**
 * Injectable time sources for the sync layer, so tests drive timers and the clock deterministically
 * (fake-indexeddb relies on real timers, so global fake timers cannot be used alongside it).
 */
export interface Timers {
  setTimeout(callback: () => void, ms: number): number
  clearTimeout(handle: number): void
}

/** Current time; the sync layer stores timestamps as ISO strings derived from it. */
export type Clock = () => Date

export const browserTimers: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
}

export const systemClock: Clock = () => new Date()
