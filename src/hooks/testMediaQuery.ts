import { vi } from 'vitest'

/** Controllable window.matchMedia for tests: `set(query, matches)` notifies listeners. */
export function installMatchMedia(initial: Record<string, boolean> = {}) {
  const state = new Map(Object.entries(initial))
  const listeners = new Map<string, Set<() => void>>()

  function matchMedia(query: string): MediaQueryList {
    return {
      get matches() {
        return state.get(query) ?? false
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        const set = listeners.get(query) ?? new Set()
        set.add(listener)
        listeners.set(query, set)
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.get(query)?.delete(listener)
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  }

  vi.stubGlobal('matchMedia', matchMedia)
  return {
    set(query: string, matches: boolean) {
      state.set(query, matches)
      for (const listener of listeners.get(query) ?? []) listener()
    },
    listenerCount: (query: string) => listeners.get(query)?.size ?? 0,
  }
}
