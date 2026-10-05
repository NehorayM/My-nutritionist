import type { ConnectionState } from '@/types'
import type { Clock, Timers } from '../timers'

/**
 * Deterministic timers + clock for sync tests (fake-indexeddb needs real timers, so global fake
 * timers cannot be used). Time only moves through `advance`.
 */
export interface ManualTimers extends Timers {
  clock: Clock
  now(): number
  /** Moves time forward, firing every due timer in time order (including timers created meanwhile). */
  advance(ms: number): void
  /** Remaining delays of the scheduled timers, ascending. */
  scheduled(): number[]
}

export function createManualTimers(start = Date.parse('2026-10-04T08:00:00.000Z')): ManualTimers {
  let now = start
  let nextHandle = 1
  const timers = new Map<number, { at: number; callback: () => void }>()

  const nextDue = (limit: number): [number, { at: number; callback: () => void }] | undefined =>
    [...timers.entries()].filter(([, t]) => t.at <= limit).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]

  return {
    clock: () => new Date(now),
    now: () => now,
    setTimeout(callback, ms) {
      const handle = nextHandle++
      timers.set(handle, { at: now + Math.max(0, ms), callback })
      return handle
    },
    clearTimeout(handle) {
      timers.delete(handle)
    },
    advance(ms) {
      const target = now + ms
      for (let due = nextDue(target); due; due = nextDue(target)) {
        const [handle, timer] = due
        timers.delete(handle)
        now = Math.max(now, timer.at)
        timer.callback()
      }
      now = target
    },
    scheduled: () => [...timers.values()].map((t) => t.at - now).sort((a, b) => a - b),
  }
}

/** Connectivity stand-in whose state the test sets; `verify` resolves with the current state. */
export function createFakeConnectivity(initial: ConnectionState = 'connected') {
  let state = initial
  let verifications = 0
  const listeners = new Set<(state: ConnectionState) => void>()
  return {
    getState: () => state,
    verify: () => {
      verifications += 1
      return Promise.resolve(state)
    },
    subscribe(listener: (state: ConnectionState) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(next: ConnectionState) {
      state = next
      for (const listener of [...listeners]) listener(next)
    },
    verifications: () => verifications,
  }
}
