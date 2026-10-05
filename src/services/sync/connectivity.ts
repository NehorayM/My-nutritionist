import type { SupabaseConfig } from '@/lib/env'
import type { ConnectionState } from '@/types'
import { backoffDelayMs, type BackoffPolicy } from './backoff'
import { createListenerSet } from './listeners'
import { browserTimers, type Timers } from './timers'

/** The Supabase project to check: its URL and the browser-safe (publishable/anon) key. */
export interface ConnectivityTarget {
  url: string
  key: string
}

/** Source of the browser's `online` / `offline` events (`window` in the app, an EventTarget in tests). */
export interface NetworkEvents {
  addEventListener(type: 'online' | 'offline', listener: () => void): void
  removeEventListener(type: 'online' | 'offline', listener: () => void): void
}

export interface ConnectivityOptions {
  /** null, or an unconfigured `SupabaseConfig` → permanently 'unconfigured' (Offline/Local mode). */
  config: SupabaseConfig | ConnectivityTarget | null
  fetchImpl?: typeof fetch
  timers?: Timers
  /** Default: `window` (none outside a browser). Pass null to ignore browser events. */
  events?: NetworkEvents | null
  /** The browser's own network hint. Default: `navigator.onLine`. */
  isBrowserOnline?: () => boolean
  /** Each check is aborted after this many ms. Default 5 000. */
  timeoutMs?: number
  /** Re-check delays while the server is unreachable but the browser is online. */
  recheck?: BackoffPolicy
}

/**
 * Reachability of Supabase, proven by a REAL request (`GET {url}/auth/v1/health` with the `apikey`
 * header): 'connected' only after a successful response. Starts as 'checking' — call `verify()` at
 * startup. Browser `offline` events switch to 'offline' at once; `online` events re-verify; while the
 * server is unreachable and the browser is online, re-checks run with exponential backoff.
 */
export interface ConnectivityMonitor {
  getState(): ConnectionState
  /** Runs (or joins) a check and resolves with the resulting state. */
  verify(): Promise<ConnectionState>
  /** Called on every state change. */
  subscribe(listener: (state: ConnectionState) => void): () => void
  dispose(): void
}

export const HEALTH_PATH = '/auth/v1/health'
export const DEFAULT_VERIFY_TIMEOUT_MS = 5_000
export const DEFAULT_RECHECK: BackoffPolicy = { baseMs: 5_000, maxMs: 300_000 }

function resolveTarget(config: ConnectivityOptions['config']): ConnectivityTarget | null {
  if (config === null) return null
  if ('configured' in config) return config.configured ? { url: config.url, key: config.key } : null
  return config
}

function defaultEvents(): NetworkEvents | null {
  return typeof window === 'undefined' ? null : window
}

export function createConnectivityMonitor(options: ConnectivityOptions): ConnectivityMonitor {
  const listeners = createListenerSet<ConnectionState>('connectivity')
  const target = resolveTarget(options.config)
  if (!target) {
    return {
      getState: () => 'unconfigured',
      verify: () => Promise.resolve('unconfigured'),
      subscribe: (listener) => listeners.add(listener),
      dispose: () => listeners.clear(),
    }
  }

  const { key } = target
  const fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  const timers = options.timers ?? browserTimers
  const events = options.events === undefined ? defaultEvents() : options.events
  const browserOnline = options.isBrowserOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine)
  const timeoutMs = options.timeoutMs ?? DEFAULT_VERIFY_TIMEOUT_MS
  const recheckPolicy = options.recheck ?? DEFAULT_RECHECK
  const healthUrl = new URL(HEALTH_PATH, target.url).toString()

  let state: ConnectionState = browserOnline() ? 'checking' : 'offline'
  let inFlight: Promise<ConnectionState> | null = null
  /** Bumped by `offline` events and dispose so results of older checks are ignored. */
  let generation = 0
  let failures = 0
  let recheckTimer: number | null = null
  let disposed = false

  const setState = (next: ConnectionState): void => {
    if (next === state) return
    state = next
    listeners.emit(next)
  }

  const clearRecheck = (): void => {
    if (recheckTimer === null) return
    timers.clearTimeout(recheckTimer)
    recheckTimer = null
  }

  const scheduleRecheck = (): void => {
    clearRecheck()
    // Without a network the browser's `online` event triggers the next check instead.
    if (disposed || !browserOnline()) return
    failures += 1
    recheckTimer = timers.setTimeout(() => {
      recheckTimer = null
      void verify()
    }, backoffDelayMs(failures, recheckPolicy))
  }

  const probe = async (): Promise<boolean> => {
    if (!browserOnline()) return false
    const controller = new AbortController()
    const timeout = timers.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(healthUrl, {
        method: 'GET',
        headers: { apikey: key },
        cache: 'no-store',
        signal: controller.signal,
      })
      return response.ok
    } catch {
      return false
    } finally {
      timers.clearTimeout(timeout)
    }
  }

  const verify = (): Promise<ConnectionState> => {
    if (disposed) return Promise.resolve(state)
    if (inFlight) return inFlight
    const startedIn = generation
    // A known-good connection stays 'connected' while it is re-checked (no status flicker).
    if (state !== 'connected') setState('checking')
    const check: Promise<ConnectionState> = probe()
      .then((reachable) => {
        if (disposed || startedIn !== generation) return state
        if (reachable) {
          failures = 0
          clearRecheck()
          setState('connected')
        } else {
          setState('offline')
          scheduleRecheck()
        }
        return state
      })
      .finally(() => {
        if (inFlight === check) inFlight = null
      })
    inFlight = check
    return check
  }

  const handleOnline = (): void => {
    failures = 0
    clearRecheck()
    void verify()
  }

  const handleOffline = (): void => {
    generation += 1
    inFlight = null
    clearRecheck()
    setState('offline')
  }

  events?.addEventListener('online', handleOnline)
  events?.addEventListener('offline', handleOffline)

  return {
    getState: () => state,
    verify,
    subscribe: (listener) => listeners.add(listener),
    dispose() {
      disposed = true
      generation += 1
      clearRecheck()
      events?.removeEventListener('online', handleOnline)
      events?.removeEventListener('offline', handleOffline)
      listeners.clear()
    },
  }
}
